export type PublicOperator = { slug: string; name: string };
export type OperatorCatalogueResult = { status: 'ready'; operators: PublicOperator[] } | { status: 'unavailable' };
export type RoomCatalogueResult<Catalog> = { status: 'ready'; catalog: Catalog } | { status: 'not-found' | 'unavailable' };
export type CatalogRequestOptions = { fetchImpl?: typeof fetch; signal?: AbortSignal };
export interface PlayerCatalog<Catalog> {
  operatorPublicView(payload: unknown, slug: unknown): PublicOperator | null;
  loadOperatorCatalogue(options?: CatalogRequestOptions): Promise<OperatorCatalogueResult>;
  loadRoomCatalogue(slug: string, options?: CatalogRequestOptions): Promise<RoomCatalogueResult<Catalog>>;
}
export function createPlayerCatalog<Catalog>(validators: {
  isOperatorSlug(value: unknown): boolean;
  validatePublicOperatorRooms(value: unknown, options: { operatorSlug: string }): Catalog;
}): PlayerCatalog<Catalog>;
