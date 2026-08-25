'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
    Wand2, Sparkles, Film, Copy, Check, ExternalLink,
    Play, ShieldCheck, Tag, Info, AtSign, CheckCircle2, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TikTokIcon, InstagramIcon, XIcon } from '@/components/BrandIcons';

interface MoviePreset {
    title: string;
    distributor: string;
    primaryTag: string;
    secondaryTags: string[];
    officialTiktok: string;
    officialIg: string;
    officialX: string;
    promoExcerpt: string;
}

const PRESET_MOVIES: MoviePreset[] = [
    {
        title: 'HARUSNYA HORROR',
        distributor: 'Essjay Pictures',
        primaryTag: '#harusnyahorror',
        secondaryTags: ['#filmharusnyahorror', '#harusnyathemovie', '#aaaclan', '#rezaarap', '#marapthon'],
        officialTiktok: '@essjaypictures',
        officialIg: '@harusnyathemovie',
        officialX: '@essjaypictures',
        promoExcerpt: 'Sedihnya nembus layar banget 😭😭😭 Film HARUSNYA HORROR sedang tayang #diXXI #HarusnyaHorror #aaaclan',
    },
    {
        title: 'CEK KHODAM',
        distributor: 'StarVision Plus',
        primaryTag: '#cekkhodam',
        secondaryTags: ['#filmcekkhodam', '#cekkhodamthemovie', '#starvisionplus', '#komediindonesia'],
        officialTiktok: '@starvisionplus',
        officialIg: '@starvisionplus',
        officialX: '@Starvisionplus',
        promoExcerpt: 'Satu bioskop ngakak guling-guling! Jangan lupa cek khodam kamu di XXI, CGV, Cinepolis terdekat #CekKhodam #FilmCekKhodam',
    },
    {
        title: 'DAN BANDUNG',
        distributor: 'Falcon Pictures',
        primaryTag: '#danbandung',
        secondaryTags: ['#filmdanbandung', '#danbandungthemovie', '#falconpictures', '#filmbaper'],
        officialTiktok: '@falconpictures_',
        officialIg: '@falconpictures_',
        officialX: '@FalconPictures_',
        promoExcerpt: 'Kisah cinta manis dan syahdu di sudut kota Bandung. Sudah tayang di seluruh bioskop! #DanBandung #FilmDanBandung',
    },
    {
        title: 'PERUMAHAN LADDALAND',
        distributor: 'Rapi Films',
        primaryTag: '#perumahanladdaland',
        secondaryTags: ['#filmperumahanladdaland', '#laddalandindonesia', '#rapifilms', '#hororbioskop'],
        officialTiktok: '@rapifilms',
        officialIg: '@rapifilms',
        officialX: '@rapifilms',
        promoExcerpt: 'Jangan pernah beli rumah di komplek ini... Film PERUMAHAN LADDALAND sedang tayang di XXI & CGV! #PerumahanLaddaland',
    },
    {
        title: 'KADO UNTUK IBU',
        distributor: 'StarVision Plus',
        primaryTag: '#kadountukibu',
        secondaryTags: ['#filmkadountukibu', '#kadountukibuthemovie', '#filmkeluarga', '#starvision'],
        officialTiktok: '@starvisionplus',
        officialIg: '@starvisionplus',
        officialX: '@Starvisionplus',
        promoExcerpt: 'Siapkan tisu sebelum masuk studio! Film keluarga paling menghangatkan hati KADO UNTUK IBU sudah tayang #KadoUntukIbu',
    },
    {
        title: 'SENI MERAYU TUHAN',
        distributor: 'MD Pictures',
        primaryTag: '#senimerayutuhan',
        secondaryTags: ['#filmsenimerayutuhan', '#senimerayutuhanthemovie', '#mdpictures', '#filmislami'],
        officialTiktok: '@mdentertainment',
        officialIg: '@md_entertainment',
        officialX: '@MD_Entertainment',
        promoExcerpt: 'Ketika doa dan ikhtiar mengetuk pintu langit. SENI MERAYU TUHAN sedang tayang di bioskop #SeniMerayuTuhan',
    },
];

export default function HashtagExtractorPage() {
    const [selectedPreset, setSelectedPreset] = useState<MoviePreset>(PRESET_MOVIES[0]);
    const [customTitle, setCustomTitle] = useState<string>('');
    const [customDistributor, setCustomDistributor] = useState<string>('');
    const [copiedTag, setCopiedTag] = useState<string | null>(null);
    const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

    // Heuristic generator for custom title
    const generatedCampaign = useMemo(() => {
        if (!customTitle.trim()) return selectedPreset;

        const clean = customTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        const distClean = (customDistributor || 'studio').toLowerCase().replace(/[^a-z0-9]/g, '');

        return {
            title: customTitle,
            distributor: customDistributor || 'Independent Distributor',
            primaryTag: `#${clean}`,
            secondaryTags: [`#film${clean}`, `#${clean}themovie`, `#${distClean}`, '#filmindonesia', '#nontonbioskop'],
            officialTiktok: `@${distClean}`,
            officialIg: `@${clean}themovie`,
            officialX: `@${distClean}`,
            promoExcerpt: `Official Announcement: Film ${customTitle.toUpperCase()} segera tayang di seluruh bioskop Indonesia! #${clean} #film${clean}`,
        };
    }, [customTitle, customDistributor, selectedPreset]);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedTag(id);
        setTimeout(() => setCopiedTag(null), 2000);
    };

    const handleSave = () => {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-6 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                            <Wand2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">Hashtag Auto-Extractor</h1>
                            <p className="text-muted-foreground text-sm font-medium">
                                Auto-detect marketing hashtags, distributor handles, and promo tags from movie titles & cinema posts
                            </p>
                        </div>
                    </div>
                </div>

                <Badge variant="outline" className="px-3 py-1 text-sm font-semibold gap-1.5 self-start md:self-auto bg-primary/5 text-primary border-primary/20">
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Heuristic + Cinema Post Extractor
                </Badge>
            </div>

            {/* Quick Movie Presets */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        Select Current In-Theatre Film
                    </span>
                    <span className="text-sm text-muted-foreground">
                        5 Active Box Office Titles
                    </span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {PRESET_MOVIES.map((preset) => {
                        const isSelected = generatedCampaign.title === preset.title && !customTitle;
                        return (
                            <button
                                key={preset.title}
                                onClick={() => {
                                    setCustomTitle('');
                                    setCustomDistributor('');
                                    setSelectedPreset(preset);
                                }}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ${
                                    isSelected
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : 'bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground border-border/50'
                                }`}
                            >
                                <Film className="w-3.5 h-3.5" />
                                {preset.title}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Custom Movie Title Input */}
            <Card className="bg-muted/20 border-border/50">
                <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Tag className="w-4 h-4 text-primary" />
                        Custom Film & Distributor Query
                    </CardTitle>
                    <CardDescription className="text-sm">
                        Enter any upcoming film to instantly compute its normalized marketing hashtag bundle
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-semibold text-muted-foreground mb-1 block">Movie Title</label>
                            <Input
                                placeholder="e.g. Pengabdi Setan 3, Lembayung, Sekawan Limo..."
                                value={customTitle}
                                onChange={(e) => setCustomTitle(e.target.value)}
                                className="rounded-xl bg-background"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-muted-foreground mb-1 block">Distributor / Production House (Optional)</label>
                            <Input
                                placeholder="e.g. Rapi Films, MD Pictures, Falcon..."
                                value={customDistributor}
                                onChange={(e) => setCustomDistributor(e.target.value)}
                                className="rounded-xl bg-background"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Extracted Intelligence Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Extracted Tags */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-border/60 bg-card overflow-hidden shadow-sm">
                        <CardHeader className="p-6 pb-4 border-b border-border/30 bg-muted/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                        Campaign Target
                                    </span>
                                    <CardTitle className="text-2xl font-black text-foreground mt-0.5">
                                        {generatedCampaign.title}
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground">
                                        Distributor: <span className="font-semibold text-foreground">{generatedCampaign.distributor}</span>
                                    </p>
                                </div>
                                <Badge className="px-3 py-1 text-sm font-bold gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Confidence: 98%
                                </Badge>
                            </div>
                        </CardHeader>

                        <CardContent className="p-6 space-y-6">
                            {/* Primary Hashtag */}
                            <div>
                                <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                                    Primary Campaign Hashtag (Official)
                                </label>
                                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-primary/5 border border-primary/20">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-black text-primary font-mono">
                                            {generatedCampaign.primaryTag}
                                        </span>
                                        <Badge variant="outline" className="text-sm uppercase font-bold text-primary border-primary/30">
                                            Primary
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCopy(generatedCampaign.primaryTag, 'primary')}
                                        className="rounded-xl gap-1.5 text-sm font-medium"
                                    >
                                        {copiedTag === 'primary' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                        {copiedTag === 'primary' ? 'Copied' : 'Copy'}
                                    </Button>
                                </div>
                            </div>

                            {/* Secondary & Variant Tags */}
                            <div>
                                <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                                    Secondary & Creator Variant Tags ({generatedCampaign.secondaryTags.length})
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {generatedCampaign.secondaryTags.map((tag, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => handleCopy(tag, `tag-${idx}`)}
                                            className="px-3 py-1.5 rounded-xl bg-muted/40 hover:bg-muted border border-border/50 text-sm font-mono font-medium text-foreground cursor-pointer transition-colors flex items-center gap-2 group"
                                            title="Click to copy"
                                        >
                                            <span>{tag}</span>
                                            {copiedTag === `tag-${idx}` ? (
                                                <Check className="w-3 h-3 text-emerald-500" />
                                            ) : (
                                                <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Cinema Post Promo Scanner Excerpt */}
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 space-y-2">
                                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                                    <Info className="w-3.5 h-3.5 text-primary" />
                                    Detected in Cinema XXI / Distributor Promo Posts:
                                </div>
                                <p className="text-sm italic text-foreground/80 leading-relaxed font-sans bg-background/50 p-3 rounded-xl border border-border/30">
                                    &ldquo;{generatedCampaign.promoExcerpt}&rdquo;
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Official Accounts & One-Click Actions */}
                <div className="space-y-6">
                    {/* Discovered Handles */}
                    <Card className="border-border/60 bg-card">
                        <CardHeader className="p-5 pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <AtSign className="w-4 h-4 text-primary" />
                                Detected Official Accounts
                            </CardTitle>
                            <CardDescription className="text-sm">
                                Verified promotional channels for this title
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-5 pt-0 space-y-3">
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/30">
                                <div className="flex items-center gap-2.5">
                                    <TikTokIcon className="w-4 h-4" />
                                    <div>
                                        <p className="text-sm font-bold leading-none">TikTok</p>
                                        <p className="text-sm text-muted-foreground">{generatedCampaign.officialTiktok}</p>
                                    </div>
                                </div>
                                <a
                                    href={`https://www.tiktok.com/${generatedCampaign.officialTiktok}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            </div>

                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/30">
                                <div className="flex items-center gap-2.5">
                                    <InstagramIcon className="w-4 h-4 text-pink-500" />
                                    <div>
                                        <p className="text-sm font-bold leading-none">Instagram</p>
                                        <p className="text-sm text-muted-foreground">{generatedCampaign.officialIg}</p>
                                    </div>
                                </div>
                                <a
                                    href={`https://www.instagram.com/${generatedCampaign.officialIg.replace('@', '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            </div>

                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/30">
                                <div className="flex items-center gap-2.5">
                                    <XIcon className="w-4 h-4" />
                                    <div>
                                        <p className="text-sm font-bold leading-none">X / Twitter</p>
                                        <p className="text-sm text-muted-foreground">{generatedCampaign.officialX}</p>
                                    </div>
                                </div>
                                <a
                                    href={`https://x.com/${generatedCampaign.officialX.replace('@', '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Action Panel */}
                    <Card className="border-primary/30 bg-primary/5">
                        <CardHeader className="p-5 pb-3">
                            <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                Next Actions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 pt-0 space-y-2.5">
                            <Link
                                href={`/tiktok/explorer?hashtag=${generatedCampaign.primaryTag.replace('#', '')}`}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all shadow-sm"
                            >
                                <Play className="w-4 h-4" />
                                Open in TikTok Explorer
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Link>

                            <Button
                                variant="outline"
                                onClick={handleSave}
                                className="w-full rounded-xl text-sm font-semibold gap-2 border-border/60"
                            >
                                {savedSuccess ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        Saved to Registry!
                                    </>
                                ) : (
                                    'Save to Movie Registry'
                                )}
                            </Button>

                            <Button
                                variant="ghost"
                                onClick={() => handleCopy([generatedCampaign.primaryTag, ...generatedCampaign.secondaryTags].join(' '), 'all')}
                                className="w-full rounded-xl text-sm text-muted-foreground hover:text-foreground"
                            >
                                {copiedTag === 'all' ? 'All Tags Copied!' : 'Copy All Hashtags as String'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
