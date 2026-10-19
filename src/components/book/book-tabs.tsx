"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OutlineTab } from "./outline-tab";
import { ProductionTab } from "./production-tab";
import { PagesTab } from "./pages-tab";
import { CoverTab } from "./cover-tab";
import { ExportsTab } from "./exports-tab";
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
}) {
  return (
    <Tabs defaultValue={props.defaultTab}>
      <TabsList>
        <TabsTrigger value="outline">Sommaire ({props.activities.length})</TabsTrigger>
        <TabsTrigger value="production">Production</TabsTrigger>
        <TabsTrigger value="pages">Pages ({props.pages.length})</TabsTrigger>
        <TabsTrigger value="cover">Couverture</TabsTrigger>
        <TabsTrigger value="exports">Exports ({props.exports.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="outline"><OutlineTab book={props.book} activities={props.activities} /></TabsContent>
      <TabsContent value="production"><ProductionTab book={props.book} activities={props.activities} jobs={props.jobs} activeJobId={props.activeJobId} estimate={props.estimate} settings={props.settings} /></TabsContent>
      <TabsContent value="pages"><PagesTab book={props.book} pages={props.pages} /></TabsContent>
      <TabsContent value="cover"><CoverTab book={props.book} cover={props.cover} illustrations={props.coverIllustrations} /></TabsContent>
      <TabsContent value="exports"><ExportsTab book={props.book} exports={props.exports} snapshots={props.snapshots} /></TabsContent>
    </Tabs>
  );
}
