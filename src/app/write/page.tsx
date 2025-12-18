'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Step = 1 | 2 | 3;

interface Collection {
  handle: string;
  name: string;
  productsCount?: number;
}

interface Product {
  id: string;
  handle: string;
  title: string;
  url: string;
  featuredImage?: { url: string; altText: string | null } | null;
  variants: Array<{ title: string; price: string; url: string }>;
}

interface BlogSection {
  type: string;
  heading?: string;
  title?: string;
  content?: string;
  variant?: string;
  items?: unknown[];
  questions?: unknown[];
  steps?: unknown[];
  products?: unknown[];
  [key: string]: unknown;
}

interface BlogContent {
  meta: {
    title: string;
    metaDescription: string;
    primaryKeyword: string;
    secondaryKeywords?: string[];
  };
  hero: {
    subtitle: string;
    badges: string[];
    heroImage?: string;
  };
  sections: BlogSection[];
  cta?: {
    title: string;
    text: string;
    buttonText: string;
    productHandle?: string;
    buttonUrl?: string;
  };
}

const ANGLE_OPTIONS = [
  { value: 'howto', label: 'How-To Guide', desc: 'Step-by-step instructions' },
  { value: 'comparison', label: 'Comparison', desc: 'Compare with alternatives' },
  { value: 'safety', label: 'Safety Guide', desc: 'Safe handling & compliance' },
  { value: 'technical', label: 'Technical Deep-Dive', desc: 'Specs & properties' },
  { value: 'application', label: 'Application Guide', desc: 'Industry use cases' },
  { value: 'guide', label: 'Comprehensive Guide', desc: 'Full product overview' },
];

const LENGTH_OPTIONS = [
  { value: 'short', label: 'Short', words: '~1,000 words' },
  { value: 'medium', label: 'Medium', words: '~2,000 words' },
  { value: 'long', label: 'Long', words: '~3,500 words' },
];

const MUST_INCLUDE_OPTIONS = [
  { id: 'safety', label: 'Safety warnings' },
  { id: 'table', label: 'Comparison table' },
  { id: 'faqs', label: 'FAQs section' },
  { id: 'steps', label: 'Process steps' },
  { id: 'case-study', label: 'Case study' },
];

const SECTION_ICONS: Record<string, string> = {
  text: '📝',
  callout: '⚠️',
  table: '📊',
  comparison: '⚖️',
  'process-steps': '📋',
  'case-study': '💼',
  'product-grid': '🛒',
  image: '🖼️',
  faq: '❓',
};

export default function WritePage() {
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [angle, setAngle] = useState('guide');
  const [targetLength, setTargetLength] = useState('medium');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [mustInclude, setMustInclude] = useState<string[]>(['faqs', 'safety']);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [tone, setTone] = useState('professional');

  // Step 2 state
  const [content, setContent] = useState<BlogContent | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  // Step 3 state
  const [html, setHtml] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedPost, setSavedPost] = useState<{ id: string; slug: string; title: string } | null>(null);

  // Shared state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load collections on mount
  useEffect(() => {
    fetch('/api/writer')
      .then((res) => res.json())
      .then((data) => setCollections(data.collections || []))
      .catch(() => {});
  }, []);

  // Load products when collection changes
  useEffect(() => {
    if (!selectedCollection) {
      setProducts([]);
      setSelectedProduct('');
      return;
    }

    setLoadingProducts(true);
    const endpoint = selectedCollection === 'all'
      ? '/api/writer?collection=all'
      : `/api/writer?collection=${selectedCollection}`;

    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || []);
        setSelectedProduct('');
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [selectedCollection]);

  async function generateArticle() {
    if (!selectedProduct) {
      setError('Please select a product');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/writer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-article',
          productHandle: selectedProduct,
          angle,
          targetLength,
          primaryKeyword: primaryKeyword || undefined,
          mustInclude: mustInclude.length > 0 ? mustInclude : undefined,
          tone,
          additionalNotes: additionalNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setContent(data.content);
      setHtml(data.html);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate article');
    } finally {
      setLoading(false);
    }
  }

  async function regenerateSection(index: number) {
    if (!content) return;

    setRegeneratingIndex(index);
    const section = content.sections[index];

    try {
      const res = await fetch('/api/writer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate-section',
          sectionIndex: index,
          sectionType: section.type,
          context: {
            productHandle: selectedProduct,
            angle,
            primaryKeyword: content.meta.primaryKeyword,
          },
          existingSections: content.sections,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update the section in content
      const newSections = [...content.sections];
      newSections[index] = data.section;
      setContent({ ...content, sections: newSections });

      // Re-render HTML
      await renderHtml({ ...content, sections: newSections });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to regenerate section');
    } finally {
      setRegeneratingIndex(null);
    }
  }

  async function renderHtml(contentToRender: BlogContent) {
    try {
      const res = await fetch('/api/writer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'render-html',
          content: contentToRender,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setHtml(data.html);
    } catch (e) {
      console.error('Failed to render HTML:', e);
    }
  }

  function copyHtml() {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveArticle() {
    if (!content || !html) return;

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/writer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-article',
          content,
          html,
          productHandle: selectedProduct,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSavedPost({
        id: data.postId,
        slug: data.slug,
        title: data.title,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save article');
    } finally {
      setSaving(false);
    }
  }

  function getSectionLabel(section: BlogSection): string {
    const icon = SECTION_ICONS[section.type] || '📄';
    const name = section.heading || section.title || section.type;
    return `${icon} ${name}`;
  }

  function getSectionPreview(section: BlogSection): string {
    if (section.content) {
      return section.content.slice(0, 100) + (section.content.length > 100 ? '...' : '');
    }
    if (section.questions && Array.isArray(section.questions)) {
      return `${section.questions.length} questions`;
    }
    if (section.steps && Array.isArray(section.steps)) {
      return `${section.steps.length} steps`;
    }
    if (section.items && Array.isArray(section.items)) {
      return `${section.items.length} items`;
    }
    if (section.products && Array.isArray(section.products)) {
      return `${section.products.length} products`;
    }
    return section.type;
  }

  function toggleMustInclude(id: string) {
    setMustInclude(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function reset() {
    setStep(1);
    setContent(null);
    setHtml('');
    setError('');
    setCopied(false);
    setSavedPost(null);
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Blog Writer</h1>
          <p className="text-muted-foreground">Generate blog articles from your products</p>
        </div>

        {/* Progress */}
        <div className="flex justify-center gap-2 items-center">
          {[
            { num: 1, label: 'Setup' },
            { num: 2, label: 'Edit' },
            { num: 3, label: 'Export' },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  s.num < step
                    ? 'bg-primary text-primary-foreground'
                    : s.num === step
                      ? 'border-2 border-primary text-primary'
                      : 'border border-muted text-muted-foreground'
                }`}
              >
                {s.num < step ? '✓' : s.num}
              </div>
              <span className={`ml-2 text-sm ${s.num === step ? 'font-medium' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {i < 2 && <div className="w-8 h-px bg-border mx-2" />}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-4">
              <p className="text-destructive text-sm">{error}</p>
              <Button variant="ghost" size="sm" onClick={() => setError('')} className="mt-2">
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Setup */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>1. Setup</CardTitle>
              <CardDescription>Configure your article parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Product Selection */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Collection</label>
                  <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select collection" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products</SelectItem>
                      {collections.map((c) => (
                        <SelectItem key={c.handle} value={c.handle}>
                          {c.name} {c.productsCount ? `(${c.productsCount})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Product *</label>
                  <Select
                    value={selectedProduct}
                    onValueChange={setSelectedProduct}
                    disabled={loadingProducts || products.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingProducts ? 'Loading...' : 'Select product'} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.handle} value={p.handle}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Angle Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Article Angle</label>
                <div className="grid gap-2 md:grid-cols-3">
                  {ANGLE_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      onClick={() => setAngle(opt.value)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        angle === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Length Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Length</label>
                <div className="flex gap-2">
                  {LENGTH_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant={targetLength === opt.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTargetLength(opt.value)}
                    >
                      {opt.label} <span className="text-xs ml-1 opacity-70">{opt.words}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* SEO Keyword */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Primary Keyword (optional)</label>
                <Input
                  placeholder="e.g., industrial ethylene glycol"
                  value={primaryKeyword}
                  onChange={(e) => setPrimaryKeyword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Leave blank to let AI suggest</p>
              </div>

              {/* Must Include */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Must Include</label>
                <div className="flex flex-wrap gap-3">
                  {MUST_INCLUDE_OPTIONS.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={mustInclude.includes(opt.id)}
                        onCheckedChange={() => toggleMustInclude(opt.id)}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tone</label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="conversational">Conversational</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Additional Notes (optional)</label>
                <Textarea
                  placeholder="Any specific requirements or context..."
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={generateArticle}
                disabled={loading || !selectedProduct}
                className="w-full"
                size="lg"
              >
                {loading ? 'Generating Article...' : 'Generate Article →'}
              </Button>

              {loading && (
                <p className="text-sm text-muted-foreground text-center">
                  This may take 30-60 seconds...
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Edit Sections */}
        {step === 2 && content && (
          <Card>
            <CardHeader>
              <CardTitle>2. Edit Sections</CardTitle>
              <CardDescription>
                {content.meta.title}
                <br />
                <span className="text-xs">Keyword: {content.meta.primaryKeyword}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Hero info */}
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium">Hero Section</p>
                <p className="text-sm text-muted-foreground">{content.hero.subtitle}</p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {content.hero.badges.map((b, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{b}</Badge>
                  ))}
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-2">
                {content.sections.map((section, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {getSectionLabel(section)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {getSectionPreview(section)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => regenerateSection(index)}
                      disabled={regeneratingIndex !== null}
                      className="ml-2 shrink-0"
                    >
                      {regeneratingIndex === index ? '...' : '⟲'}
                    </Button>
                  </div>
                ))}
              </div>

              {/* CTA info */}
              {content.cta && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm font-medium">Call to Action</p>
                  <p className="text-sm">{content.cta.title}</p>
                  <p className="text-xs text-muted-foreground">{content.cta.text}</p>
                </div>
              )}

              {/* Meta info */}
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium">SEO Meta</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {content.meta.metaDescription}
                </p>
                {content.meta.secondaryKeywords && content.meta.secondaryKeywords.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {content.meta.secondaryKeywords.map((k, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{k}</Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={reset}>
                  ← Start Over
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1">
                  Preview HTML →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Preview & Export */}
        {step === 3 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>3. Preview & Export</CardTitle>
                <CardDescription>Review the rendered HTML and copy to Shopify</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {savedPost && (
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-800">
                    <p className="font-medium">Saved to database!</p>
                    <p className="text-sm">
                      <a href={`/admin/posts/${savedPost.id}`} className="underline">
                        View draft: {savedPost.title}
                      </a>
                    </p>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={copyHtml} className="flex-1">
                    {copied ? '✓ Copied!' : 'Copy HTML'}
                  </Button>
                  <Button
                    onClick={saveArticle}
                    disabled={saving || !!savedPost}
                    variant={savedPost ? 'outline' : 'default'}
                  >
                    {saving ? 'Saving...' : savedPost ? '✓ Saved' : 'Save Draft'}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    ← Edit
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    New Article
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* HTML Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Live Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="border rounded-lg overflow-hidden"
                  style={{ maxHeight: '600px', overflowY: 'auto' }}
                >
                  <iframe
                    srcDoc={html}
                    title="Blog Preview"
                    className="w-full"
                    style={{ height: '600px', border: 'none' }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Raw HTML (collapsible) */}
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                View Raw HTML
              </summary>
              <Card className="mt-2">
                <CardContent className="pt-4">
                  <pre className="text-xs overflow-auto max-h-96 p-4 bg-muted rounded-lg">
                    {html}
                  </pre>
                </CardContent>
              </Card>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
