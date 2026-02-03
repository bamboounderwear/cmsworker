export type FieldType = "text" | "image" | "richtext";

export type CollectionField = {
  name: string;
  type: FieldType;
  label?: string;
  help?: string;
};

export type CollectionDef = {
  label: string;
  template: string; // template filename under /public/_templates/
  fields: CollectionField[];
};

export const collections: Record<string, CollectionDef> = {
  landing: {
    label: "Landing Pages",
    template: "home.html",
    fields: [
      { name: "hero_title", type: "text", label: "Hero title" },
      { name: "hero_subtitle", type: "text", label: "Hero subtitle" },
      { name: "hero_image", type: "image", label: "Hero image" },
      { name: "body", type: "richtext", label: "Body" }
    ]
  },
  blog: {
    label: "Blog Posts",
    template: "post.html",
    fields: [
      { name: "title", type: "text", label: "Title" },
      { name: "cover_image", type: "image", label: "Cover image" },
      { name: "body", type: "richtext", label: "Body" }
    ]
  }
};
