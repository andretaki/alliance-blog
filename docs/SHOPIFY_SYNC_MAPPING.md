# Shopify Article Sync Mapping

Maps our canonical `BlogPost` schema to Shopify article fields and metafields.

## Field Mapping

| BlogPost Field | Shopify Target | Notes |
|----------------|----------------|-------|
| `title` | `article.title` | Direct |
| `rawHtml` | `article.content` | Full HTML body |
| `summary` | `article.excerpt` | Plain text excerpt |
| `faq[]` | `metafields.custom.faq_items` | JSON array of {question, answer} |
| `author.name` | `article.author` | Shopify author field |
| `author.role` | `metafields.custom.author_job_title` | Text metafield |
| `author.credentials` | `metafields.custom.author_bio` | Combined with details |
| `primaryKeyword` | `article.tags[]` | Add as first tag |
| `secondaryKeywords[]` | `article.tags[]` | Add as tags |
| `searchIntent` | `article.tags[]` | Map to content type tag |
| `metaTitle` | SEO title (Shopify Admin) | Via API |
| `metaDescription` | SEO description | Via API |
| `publishedAt` | `article.published_at` | ISO date |
| `ldJsonArticle` | Template renders | Not synced - template generates |
| `ldJsonFaqPage` | Template renders | From faq_items metafield |

## Content Type Tag Mapping

The Shopify template detects content types from tags. Our generator should add:

| Condition | Tag to Add |
|-----------|------------|
| `searchIntent === 'informational'` + howto content | `howto` |
| Has FAQ section | `faq` |
| Contains safety warnings | `safety` |
| Technical specifications | `technical` |
| Product comparisons | `comparison` |
| `searchIntent === 'commercial'` | `comparison` or `review` |

## Required Shopify Metafield Definitions

Create these metafields in Shopify Admin (Settings > Custom data > Articles):

### `custom.faq_items` (JSON)
```json
{
  "name": "FAQ Items",
  "namespace": "custom",
  "key": "faq_items",
  "type": "json",
  "description": "FAQ questions and answers for FAQPage schema"
}
```

Expected format:
```json
[
  {"question": "What is X?", "answer": "X is..."},
  {"question": "How do I Y?", "answer": "To Y, you..."}
]
```

### `custom.author_job_title` (Single line text)
```json
{
  "name": "Author Job Title",
  "namespace": "custom",
  "key": "author_job_title",
  "type": "single_line_text_field"
}
```

### `custom.author_bio` (Multi-line text)
```json
{
  "name": "Author Bio",
  "namespace": "custom",
  "key": "author_bio",
  "type": "multi_line_text_field"
}
```

### `custom.howto_steps` (JSON) - Optional for HowTo articles
```json
{
  "name": "HowTo Steps",
  "namespace": "custom",
  "key": "howto_steps",
  "type": "json"
}
```

Expected format:
```json
[
  {"name": "Step 1 Title", "text": "Step 1 instructions..."},
  {"name": "Step 2 Title", "text": "Step 2 instructions..."}
]
```

### `custom.rating` (Number decimal) - Optional for reviews
### `custom.reviewed_product_name` (Single line text) - Optional for reviews
### `custom.supplies_needed` (List of text) - Optional for HowTo
### `custom.estimated_cost` (Money) - Optional for HowTo
### `custom.time_required` (Single line text) - Optional for HowTo

## HTML Component Classes Expected by Template

The template's CSS expects these class names in `article.content`:

| Component | Expected HTML |
|-----------|---------------|
| Callout (info) | `<div class="ac-callout">` |
| Callout (warning) | `<div class="ac-callout warning">` or `<div class="callout warning">` |
| Callout (success) | `<div class="callout success">` |
| Callout (danger) | `<div class="callout danger">` |
| Tables | `<table>` (template wraps in `.table-responsive`) |
| FAQ section | `<section class="faq-section">` or use metafield |
| CTA section | `<div class="article-cta">` or `<div class="cta-section">` |

## Sync Implementation Notes

1. **Images**: Template extracts first image from content if no featured image
2. **Word count**: Calculated by template from stripped HTML
3. **Reading time**: Calculated as `word_count / 200 + 1` minutes
4. **Tags limit**: Template shows max 6 tags in OG meta
5. **Canonical URL**: Template generates from `shop.url + article.url`
