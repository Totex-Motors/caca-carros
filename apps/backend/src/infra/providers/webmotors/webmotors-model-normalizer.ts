export type WebmotorsModelNormalization = {
  original: string;
  base: string;
  modelSlug: string;
  modelParam: string;
  displayModel: string;
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function stripParentheses(value: string): string {
  return value.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeWebmotorsModel(rawModel: string): WebmotorsModelNormalization {
  const original = rawModel ?? '';
  const base = stripParentheses(original) || original.trim();
  const modelSlug = slugify(base) || slugify(original);
  const modelParam = modelSlug ? modelSlug.toUpperCase() : slugify(original).toUpperCase();

  return {
    original,
    base,
    modelSlug,
    modelParam,
    displayModel: base
  };
}
