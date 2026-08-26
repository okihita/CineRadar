#!/bin/bash
# Deploy JIT Seat Scraper Cloud Functions
# Usage: ./deploy.sh [component]
#   component: all, pubsub, dispatcher, scraper, scheduler

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-cineradar-481014}"
REGION="${REGION:-asia-southeast1}"
PUBSUB_TOPIC="scrape-seat-jit"

echo "🚀 CineRadar Cloud Functions & Socials Deployment"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo ""

deploy_pubsub() {
    echo "📬 Creating Pub/Sub topic..."
    gcloud pubsub topics create "$PUBSUB_TOPIC" \
        --project="$PROJECT_ID" \
        2>/dev/null || echo "   Topic already exists"
    echo "   ✓ Topic: $PUBSUB_TOPIC"
}

deploy_dispatcher() {
    echo "📤 Deploying dispatcher function..."
    cd dispatcher
    gcloud functions deploy dispatch-jit-jobs \
        --gen2 \
        --runtime=python313 \
        --region="$REGION" \
        --source=. \
        --entry-point=dispatch_jobs \
        --trigger-http \
        --allow-unauthenticated \
        --memory=256MB \
        --timeout=60s \
        --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,PUBSUB_TOPIC=$PUBSUB_TOPIC" \
        --project="$PROJECT_ID"
    cd ..
    echo "   ✓ Dispatcher deployed"
}

deploy_scraper() {
    echo "📥 Deploying scraper function..."
    cd scraper
    # =========================================================================
    # ⚠️ IMPORTANT: max_instances=10 (was 5 until March 11, 2026)
    # =========================================================================
    # On March 11, 2026, we updated the schedule from T-30/T-15 to T-30/T-20/T-10.
    # The max_instances was increased to 10 to ensure peak bursts of 800+ jobs
    # can clear in ~5.2 minutes, preserving the accuracy of our time windows.
    #
    # With max_instances=10:
    # - Peak slot processing: ~5 minutes (within 5-minute JIT window)
    # - Safe TIX API load: ~2.6 RPS / ~153 RPM
    #
    # DO NOT reduce this value without understanding the implications.
    # See: plans/seating-scrape-frequency-analysis.md
    # =========================================================================
    gcloud functions deploy scrape-seat-jit \
        --gen2 \
        --runtime=python313 \
        --region="$REGION" \
        --source=. \
        --entry-point=scrape_seat \
        --trigger-topic="$PUBSUB_TOPIC" \
        --max-instances=10 \
        --memory=512MB \
        --timeout=180s \
        --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,ENABLE_SCHEMA_VALIDATION=true" \
        --project="$PROJECT_ID"
    cd ..
    echo "   ✓ Scraper deployed (max_instances=10) with 180s timeout"
}

deploy_scheduler() {
    echo "⏰ Creating Cloud Scheduler job..."
    
    # Get dispatcher URL
    DISPATCHER_URL=$(gcloud functions describe dispatch-jit-jobs \
        --gen2 \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format='value(serviceConfig.uri)' 2>/dev/null)
    
    if [ -z "$DISPATCHER_URL" ]; then
        echo "   ❌ Error: Dispatcher function not found. Deploy dispatcher first."
        exit 1
    fi
    
    # Delete existing job if present
    gcloud scheduler jobs delete jit-dispatcher \
        --location="$REGION" \
        --project="$PROJECT_ID" \
        --quiet 2>/dev/null || true
    # Create new scheduler job (every 5 minutes, 08:00 AM - 11:59 PM Jakarta)
    # NOTE: Hours are in Jakarta time because --time-zone is set to Asia/Jakarta
    # Changed to 8-23 to catch 09:00 AM showtimes (needs 08:30 trigger for T-30)
    gcloud scheduler jobs create http jit-dispatcher \
        --location="$REGION" \
        --project="$PROJECT_ID" \
        --schedule="*/5 8-23 * * *" \
        --time-zone="Asia/Jakarta" \
        --uri="$DISPATCHER_URL" \
        --http-method=POST \
        --project="$PROJECT_ID"

    echo "   ✓ Scheduler: every 5 min (08:00-23:55 WIB)"
}

deploy_sweeper() {
    echo "🧹 Deploying sweeper function..."
    cd sweeper
    gcloud functions deploy sweeper \
        --gen2 \
        --runtime=python313 \
        --region="$REGION" \
        --source=. \
        --entry-point=run_sweeper \
        --trigger-http \
        --allow-unauthenticated \
        --memory=512MB \
        --timeout=300s \
        --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
        --project="$PROJECT_ID"
    cd ..
    
    # Create Scheduler for Sweeper
    echo "⏰ Creating Sweeper Scheduler..."
    
    SWEEPER_URL=$(gcloud functions describe sweeper \
        --gen2 \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format='value(serviceConfig.uri)' 2>/dev/null)
        
    if [ -z "$SWEEPER_URL" ]; then
        echo "   ❌ Error: Sweeper function URL not found."
    else
        # Delete existing job if present
        gcloud scheduler jobs delete jit-sweeper \
            --location="$REGION" \
            --project="$PROJECT_ID" \
            --quiet 2>/dev/null || true
            
        # =========================================================================
        # ⚠️ ARCHITECTURAL & COST CONSTRAINT: Sweeper Frequency (30-min intervals)
        # =========================================================================
        # The sweeper is scheduled at `0,30 10-23 * * *` (every 30 mins) instead of
        # 15 mins. This cuts daily Firestore document reads by ~50% (~105k reads/day)
        # while preserving real-time accuracy for dashboards.
        # DO NOT reduce this interval without calculating Firestore read billings.
        # =========================================================================
        gcloud scheduler jobs create http jit-sweeper \
            --location="$REGION" \
            --schedule="0,30 10-23 * * *" \
            --time-zone="Asia/Jakarta" \
            --uri="$SWEEPER_URL" \
            --http-method=POST \
            --project="$PROJECT_ID"
            
        echo "   ✓ Scheduler: Sweeper every 30 min (10:00-23:30 WIB)"
    fi
}

deploy_discover_hashtags() {
    echo "🔍 Deploying morning TikTok hashtag discovery function..."
    cd socials/tiktok/discover_hashtags
    gcloud functions deploy discover-tiktok-hashtags \
        --gen2 \
        --runtime=python314 \
        --region="$REGION" \
        --source=. \
        --entry-point=discover_hashtags_http \
        --trigger-http \
        --allow-unauthenticated \
        --memory=512MB \
        --timeout=300s \
        --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
        --project="$PROJECT_ID"
    cd ../../..

    echo "⏰ Creating Daily 08:00 WIB Discovery Scheduler..."
    DISCOVERY_URL=$(gcloud functions describe discover-tiktok-hashtags \
        --gen2 \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format='value(serviceConfig.uri)' 2>/dev/null)

    if [ -z "$DISCOVERY_URL" ]; then
        echo "   ❌ Error: discover-tiktok-hashtags function URL not found."
    else
        gcloud scheduler jobs delete daily-hashtag-discovery \
            --location="$REGION" \
            --project="$PROJECT_ID" \
            --quiet 2>/dev/null || true

        gcloud scheduler jobs create http daily-hashtag-discovery \
            --location="$REGION" \
            --schedule="0 8 * * *" \
            --time-zone="Asia/Jakarta" \
            --uri="$DISCOVERY_URL" \
            --http-method=POST \
            --project="$PROJECT_ID"

        echo "   ✓ Scheduler: Daily Hashtag Discovery at 08:00 WIB"
    fi
}

deploy_sync_exhibitors() {
    echo "🎪 Deploying 3-hourly TikTok exhibitor sync function..."
    cd socials/tiktok/sync_exhibitors
    gcloud functions deploy sync-tiktok-exhibitors \
        --gen2 \
        --runtime=python314 \
        --region="$REGION" \
        --source=. \
        --entry-point=sync_exhibitors_http \
        --trigger-http \
        --allow-unauthenticated \
        --memory=512MB \
        --timeout=300s \
        --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,LOG_EXECUTION_ID=true" \
        --project="$PROJECT_ID"
    cd ../../../
    
    # Create 3-Hourly Scheduler
    echo "⏰ Creating 3-Hourly Exhibitor Sync Scheduler..."
    SYNC_URL=$(gcloud functions describe sync-tiktok-exhibitors \
        --gen2 \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format='value(serviceConfig.uri)' 2>/dev/null)
        
    if [ -z "$SYNC_URL" ]; then
        echo "   ❌ Error: sync-tiktok-exhibitors URL not found."
    else
        gcloud scheduler jobs delete 3hourly-exhibitor-sync \
            --location="$REGION" \
            --project="$PROJECT_ID" \
            --quiet 2>/dev/null || true
            
        gcloud scheduler jobs create http 3hourly-exhibitor-sync \
            --location="$REGION" \
            --schedule="0 */3 * * *" \
            --time-zone="Asia/Jakarta" \
            --uri="$SYNC_URL" \
            --http-method=POST \
            --headers="User-Agent=Google-Cloud-Scheduler" \
            --project="$PROJECT_ID"
            
        echo "   ✓ Scheduler: 3-Hourly Exhibitor Sync (0 */3 * * * WIB)"
    fi
}

# Main
case "${1:-all}" in
    pubsub)
        deploy_pubsub
        ;;
    dispatcher)
        deploy_dispatcher
        ;;
    scraper)
        deploy_scraper
        ;;
    scheduler)
        deploy_scheduler
        ;;
    sweeper)
        deploy_sweeper
        ;;
    discover_hashtags|hashtags)
        deploy_discover_hashtags
        ;;
    sync_exhibitors|exhibitors)
        deploy_sync_exhibitors
        ;;
    theatrical)
        deploy_pubsub
        deploy_dispatcher
        deploy_scraper
        deploy_scheduler
        deploy_sweeper
        echo ""
        echo "✅ All Theatrical Scraper components deployed!"
        ;;
    all)
        deploy_pubsub
        deploy_dispatcher
        deploy_scraper
        deploy_scheduler
        deploy_sweeper
        deploy_discover_hashtags
        deploy_sync_exhibitors
        echo ""
        echo "✅ All components deployed!"
        ;;
    *)
        echo "Usage: $0 [pubsub|dispatcher|scraper|scheduler|sweeper|discover_hashtags|sync_exhibitors|theatrical|all]"
        exit 1
        ;;
esac
