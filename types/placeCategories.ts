export interface PlaceCategoryNode {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

export interface PlaceCategoryTreeItem {
  main: PlaceCategoryNode;
  sub_categories: PlaceCategoryNode[];
}

