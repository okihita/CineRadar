#!/bin/bash
# Deploy JIT Seat Scraper Cloud Functions
# Usage: ./deploy.sh [component]
#   component: all, pubsub, dispatcher, scraper, scheduler

set -e

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-cineradar-481014}"
REGION="${REGION:-asia-southeast1}"
PUBSUB_TOPIC="scrape-seat-jit"

echo "🚀 JIT Seat Scraper Deployment"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo ""

deploy_pubsub() {
    echo "📬 Creating Pub/Sub topic..."
    gcloud pubsub topics create $PUBSUB_TOPIC \
        --project=$PROJECT_ID \
        2>/dev/null || echo "   Topic already exists"
    echo "   ✓ Topic: $PUBSUB_TOPIC"
}

deploy_dispatcher() {
    echo "📤 Deploying dispatcher function..."
    cd dispatcher
    gcloud functions deploy dispatch-jit-jobs \
        --gen2 \
        --runtime=python312 \
        --region=$REGION \
        --source=. \
        --entry-point=dispatch_jobs \
        --trigger-http \
        --allow-unauthenticated \
        --memory=256MB \
        --timeout=60s \
        --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,PUBSUB_TOPIC=$PUBSUB_TOPIC" \
        --project=$PROJECT_ID
    cd ..
    echo "   ✓ Dispatcher deployed"
}

deploy_scraper() {
    echo "📥 Deploying scraper function..."
    cd scraper
    gcloud functions deploy scrape-seat-jit \
        --gen2 \
        --runtime=python312 \
        --region=$REGION \
        --source=. \
        --entry-point=scrape_seat \
        --trigger-topic=$PUBSUB_TOPIC \
        --max-instances=1 \
        --memory=512MB \
        --timeout=60s \
        --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,ENABLE_SCHEMA_VALIDATION=true" \
        --project=$PROJECT_ID
    cd ..
    echo "   ✓ Scraper deployed (max 10 concurrent)"
}

deploy_scheduler() {
    echo "⏰ Creating Cloud Scheduler job..."
    
    # Get dispatcher URL
    DISPATCHER_URL=$(gcloud functions describe dispatch-jit-jobs \
        --gen2 \
        --region=$REGION \
        --project=$PROJECT_ID \
        --format='value(serviceConfig.uri)' 2>/dev/null)
    
    if [ -z "$DISPATCHER_URL" ]; then
        echo "   ❌ Error: Dispatcher function not found. Deploy dispatcher first."
        exit 1
    fi
    
    # Delete existing job if present
    gcloud scheduler jobs delete jit-dispatcher \
        --location=$REGION \
        --project=$PROJECT_ID \
        --quiet 2>/dev/null || true
    
    # Create new scheduler job (every 5 minutes, 09:00 AM - 11:59 PM Jakarta)
    # NOTE: Hours are in Jakarta time because --time-zone is set to Asia/Jakarta
    # Changed to 9-23 to catch earliest showtimes (e.g. 10:00 AM needs 09:50 trigger)
    gcloud scheduler jobs create http jit-dispatcher \
        --location=$REGION \
        --schedule="*/5 9-23 * * *" \
        --time-zone="Asia/Jakarta" \
        --uri="$DISPATCHER_URL" \
        --http-method=POST \
        --project=$PROJECT_ID
    
    echo "   ✓ Scheduler: every 5 min (09:00-23:55 WIB)"
}

deploy_sweeper() {
    echo "🧹 Deploying sweeper function..."
    cd sweeper
    gcloud functions deploy sweeper \
        --gen2 \
        --runtime=python312 \
        --region=$REGION \
        --source=. \
        --entry-point=run_sweeper \
        --trigger-http \
        --allow-unauthenticated \
        --memory=512MB \
        --timeout=300s \
        --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
        --project=$PROJECT_ID
    cd ..
    
    # Create Scheduler for Sweeper
    echo "⏰ Creating Sweeper Scheduler..."
    
    SWEEPER_URL=$(gcloud functions describe sweeper \
        --gen2 \
        --region=$REGION \
        --project=$PROJECT_ID \
        --format='value(serviceConfig.uri)' 2>/dev/null)
        
    if [ -z "$SWEEPER_URL" ]; then
        echo "   ❌ Error: Sweeper function URL not found."
    else
        # Delete existing job if present
        gcloud scheduler jobs delete jit-sweeper \
            --location=$REGION \
            --project=$PROJECT_ID \
            --quiet 2>/dev/null || true
            
        # Schedule: Every 30 mins from 10:00 to 23:30
        # Cron: 0,30 10-23 * * *
        gcloud scheduler jobs create http jit-sweeper \
            --location=$REGION \
            --schedule="0,30 10-23 * * *" \
            --time-zone="Asia/Jakarta" \
            --uri="$SWEEPER_URL" \
            --http-method=POST \
            --project=$PROJECT_ID
            
        echo "   ✓ Scheduler: Sweeper every 30 min (10:00-23:30 WIB)"
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
    all)
        deploy_pubsub
        deploy_dispatcher
        deploy_scraper
        deploy_scheduler
        deploy_sweeper
        echo ""
        echo "✅ All components deployed!"
        ;;
    *)
        echo "Usage: $0 [pubsub|dispatcher|scraper|scheduler|sweeper|all]"
        exit 1
        ;;
esac
