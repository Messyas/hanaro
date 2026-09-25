export interface Person {
  id: number;
  name: string;
  profile_image_url: string | null;
}
export interface WorkflowPage<T> {
  items: T[];
  total: number;
  has_next: boolean;
}
