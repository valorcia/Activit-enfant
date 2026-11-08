"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OutlineTab } from "./outline-tab";
import { ProductionTab } from "./production-tab";
import { PagesTab } from "./pages-tab";
import { CoverTab } from "./cover-tab";
import { ExportsTab } from "./exports-tab";
import { ShopTab, type ShopSyncView } from "./shop-tab";
import { KitTab, type KitTabView } from "@/components/kits/kit-tab";
import { VideoForm, type VideoFormDefaults } from "@/components/videos/video-form";
import { VideoList } from "@/components/videos/video-list";
import type { AdVideoView } from "@/lib/video/service";
import type { BookTheme, PageLayout } from "@/lib/schemas/layout";
import type { CoverData } from "@/lib/schemas/activity";
import type { estimateBookCost } from "@/lib/queue/estimate";

export interface BookView { id: string; title: string; subtitle: string | null; collection: string | null; status: string; ageRange: string; targetCount: number; introduction: string; theme: BookTheme; widthMm: number; heightMm: number }
export interface ActivityRow { id: string; title: string; status: string; category: string; difficulty: number; durationMinutes: number; concept: Record<string, unknown> | null; hasContent: boolean; illustrations: { kind: string; status: string; isDemo: boolean; src?: string }[]; issues: { blockers: number; errors: number; warnings: number } }
export interface PageRow { id: string; templateKey: string; locked: boolean; activityId: string | null; layout: PageLayout }
export interface ExportRow { id: string; kind: string; status: string; pageCount: number | null; assetId: string | null; createdAt: string; checks: Record<string, unknown> | null; error: string | null; snapshotId: string | null }
export interface JobRow { id: string; type: string; status: string; step: string | null; progress: number; createdAt: string; costUsd: number; error: string | null }
export interface CoverIll { id: string; status: string; isDemo: boolean; isCurrent: boolean; src?: string; version: number }

export function BookTabs(props: {
  defaultTab: string;
  book: BookView;
  activities: ActivityRow[];
  pages: PageRow[];
  exports: ExportRow[];
  snapshots: { id: string; version: number; label: string | null; createdAt: string }[];
  jobs: JobRow[];
  activeJobId: string | null;
  estimate: ReturnType<typeof estimateBookCost>;
  cover: CoverData & { introduction?: string };
  coverIllustrations: CoverIll[];
  settings: { textProvider: string; imageProvider: string; stepIllustrations: boolean };
  shop: ShopSyncView;
  kit?: KitTabView | null;
  /** Chargé seulement quand l'onglet « Vidéos pub » est ouvert (calcul de la fiche et des illustrations) */
  videos?: { defaults: VideoFormDefaults; list: AdVideoView[] } | null;
  videoCount?: number;
}) {
  return (
    <Tabs defaultValue={props.defaultTab}>
      <TabsList>
        {props.kit ? <TabsTrigger value="kit">Kit</TabsTrigger> : <TabsTrigger value="outline">Sommaire ({props.activities.length})</TabsTrigger>}
        {!props.kit && <TabsTrigger value="production">Production</TabsTrigger>}
        <TabsTrigger value="apercu" asChild><a href={`/books/${props.book.id}/apercu`} className="!bg-amber-100 !text-amber-950 font-bold">Aperçu</a></TabsTrigger>
        <TabsTrigger value="pages">Pages ({props.pages.length})</TabsTrigger>
        <TabsTrigger value="cover">Couverture</TabsTrigger>
        <TabsTrigger value="exports">Exports ({props.exports.length})</TabsTrigger>
        <TabsTrigger value="shop">Boutique{props.shop.publishedAt ? " ✓" : ""}</TabsTrigger>
        <TabsTrigger value="videos" asChild><a href={`/books/${props.book.id}?tab=videos`}>Vidéos pub{props.videoCount ? ` (${props.videoCount})` : ""}</a></TabsTrigger>
      </TabsList>
      {props.kit && <TabsContent value="kit"><KitTab bookId={props.book.id} kit={props.kit} activeJobId={props.activeJobId} /></TabsContent>}
      <TabsContent value="outline"><OutlineTab book={props.book} activities={props.activities} /></TabsContent>
      <TabsContent value="production"><ProductionTab book={props.book} activities={props.activities} jobs={props.jobs} activeJobId={props.activeJobId} estimate={props.estimate} settings={props.settings} /></TabsContent>
      <TabsContent value="pages"><PagesTab book={props.book} pages={props.pages} /></TabsContent>
      <TabsContent value="cover"><CoverTab book={props.book} cover={props.cover} illustrations={props.coverIllustrations} /></TabsContent>
      <TabsContent value="exports"><ExportsTab book={props.book} exports={props.exports} snapshots={props.snapshots} /></TabsContent>
      <TabsContent value="shop"><ShopTab bookId={props.book.id} sync={props.shop} /></TabsContent>
      <TabsContent value="videos">
        {props.videos ? (
          <div className="space-y-6">
            <VideoForm bookId={props.book.id} defaults={props.videos.defaults} />
            <div>
              <h3 className="mb-3 text-base font-black text-slate-700">Vidéos de ce livre</h3>
              <VideoList videos={props.videos.list} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Chargement…</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
