export type TableLayout = 'desktop' | 'mobile';
export type TablePoint = { x: number; y: number };
export type TablePlacement = { width: number; x: number; y: number };
export type TableRect = [number, number, number, number];
export type AlphaBounds = TablePoint & { width: number; height: number; threshold: number };
export type TableSource = { filename: string; contentType: string; size: number; sha256: string };
export type DealerTableDefinition = {
  schemaVersion: 1;
  id: string;
  name: string;
  asset: { variant: string; width: number; height: number; alphaBounds: AlphaBounds; visibleBounds: AlphaBounds;
    sources: { png: TableSource; webp: TableSource } };
  palette: { felt: string; rail: string; trim: string; apron: string };
  pivot: { x: 0.5; y: 0 };
  calibration: { status: 'uncalibrated'; description: string };
  layouts: Record<TableLayout, { scene: { width: number; height: number }; placement: TablePlacement;
    anchors: { cardWidth: number; dealer: TablePoint; seats: { card: TablePoint; bet: TablePoint }[] } }>;
};
export type DealerTableGeometry = {
  dims: [number, number]; rect: TableRect; alphaRect: TableRect; visibleRect: TableRect;
  dealer: TablePoint; cardWidth: number; seats: { card: TablePoint; bet: TablePoint }[];
};
export function validateDealerTableDefinition(definition: unknown): DealerTableDefinition;
export function projectTablePoint(rect: TableRect, point: TablePoint): TablePoint;
export function getDealerTableGeometry(definition: DealerTableDefinition, layout?: TableLayout, placement?: TablePlacement): DealerTableGeometry;
