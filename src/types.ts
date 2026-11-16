export type VersionEntry = { version: string; date: string; notes: string };
export type AppEntry = {
  id: string; name: string; developer: string; bundleId: string; version: string;
  category: string; description: string; icon: string; screenshots: string[];
  iosMinimum: string; size: number | null; downloadUrl: string | null;
  sha256: string | null; source: string; addedDate: string; updatedDate: string;
  featured: boolean; popularity: number; status: 'published' | 'draft' | 'demo';
  changelog: VersionEntry[]; distributionPermission: boolean;
};
export type Category = { id: string; name: string; icon: string; description: string };
