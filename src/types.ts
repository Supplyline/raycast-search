// Entity types matching algolia-index-spec.md

export type EntityType = "series" | "parent" | "sku" | "doc";
export type Scope = "products" | "docs";

export interface BaseEntity {
  objectID: string;
  entityType: EntityType;
  title: string;
  subtitle?: string;
  brand: string;
  primaryBehavior: "drill" | "open";
  urlShop?: string;
  urlAbout?: string;
  // Algolia stores these as flat keys with dots in the name
  "drillKey.brand"?: string;
  "drillKey.series"?: string;
  "drillKey.parent"?: string;
}

export interface BrowseEntity extends BaseEntity {
  entityType: "series" | "parent";
  primaryBehavior: "drill";
  childCount: number;
  hasConfigurator: boolean;
  seriesCode?: string;
  parentCode?: string;
}

export interface SkuEntity extends BaseEntity {
  entityType: "sku";
  primaryBehavior: "open";
  mno: string;
  price: number;
  inStock: boolean;
  imageUrl?: string;
  specs?: Record<string, string>;
}

export interface DocEntity extends BaseEntity {
  entityType: "doc";
  primaryBehavior: "open";
  docType: "manual" | "datasheet" | "iom" | "sds";
  downloadUrl: string;
  fileSize?: number;
  seriesCode?: string;
}

export type SearchResult = BrowseEntity | SkuEntity | DocEntity;

export interface StackItem {
  type: "brand" | "series" | "parent";
  id: string;
  label: string;
}

export interface SearchState {
  scope: Scope;
  query: string;
  stack: StackItem[];
  results: SearchResult[];
  isLoading: boolean;
  error?: string;
}

export interface Preferences {
  showPrices: boolean;
  defaultScope?: Scope;
}
