'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Step = 1 | 2 | 3 | 4;

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

interface Topic {
  topic: string;
  primaryKeyword: string;
  angle: string;
  searchIntent: string;
  uniqueAngle: string;
  relevantProducts?: string[];
}

interface Outline {
  meta: { topic: string; targetWordCount: number };
  sections: Array<{ heading: string; keyPoints: string[] }>;
  faqSection: { questions: Array<{ question: string }> };
}

interface Post {
  id: string;
  title: string;
  wordCount: number;
  summary: string;
}

export default function WritePage() {
  const [step, setStep] = useState<Step>(1);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState('random');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('any');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [collectionInfo, setCollectionInfo] = useState<{ handle: string; name: string } | null>(null);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [context, setContext] = useState('');
  const [post, setPost] = useState<Post | null>(null);
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
    if (selectedCollection === 'random') {
      setProducts([]);
      setSelectedProduct('any');
      return;
    }

    setLoadingProducts(true);
    // Use 'all' to fetch all products, or specific collection handle
    const endpoint = selectedCollection === 'all'
      ? '/api/writer?collection=all'
      : `/api/writer?collection=${selectedCollection}`;

    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || []);
        setSelectedProduct('any');
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [selectedCollection]);

  async function generateTopics() {
    setLoading(true);
    setError('');
    setTopics([]);
    setSelectedTopic(null);
    try {
      const res = await fetch('/api/writer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'topic',
          collectionHandle: selectedCollection === 'random' ? undefined : selectedCollection,
          productHandle: selectedProduct === 'any' ? undefined : selectedProduct,
          count: 3,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTopics(data.topics);
      setCollectionInfo(data.collection);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate topics');
    } finally {
      setLoading(false);
    }
  }

  async function generateOutline() {
    if (!selectedTopic) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/writer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'outline', topic: selectedTopic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOutline(data.outline);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate outline');
    } finally {
      setLoading(false);
    }
  }

  async function generateContent() {
    if (!selectedTopic || !outline) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/writer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          topic: selectedTopic,
          outline,
          context,
          saveToDB: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPost(data.post);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate content');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep(1);
    setTopics([]);
    setSelectedTopic(null);
    setCollectionInfo(null);
    setOutline(null);
    setContext('');
    setPost(null);
    setError('');
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Content Writer</h1>
          <p className="text-muted-foreground">AI generates topics based on your products</p>
        </div>

        {/* Progress */}
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s < step
                  ? 'bg-primary text-primary-foreground'
                  : s === step
                    ? 'border-2 border-primary text-primary'
                    : 'border border-muted text-muted-foreground'
              }`}
            >
              {s < step ? '✓' : s}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-4">
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Topics */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>1. Select Product & Generate Topics</CardTitle>
              <CardDescription>Pick a collection and optionally a specific product</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Collection Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Collection</label>
                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select collection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    <SelectItem value="random">Random Collection</SelectItem>
                    {collections.map((c) => (
                      <SelectItem key={c.handle} value={c.handle}>
                        {c.name} {c.productsCount ? `(${c.productsCount})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product Selector - shows when collection or all selected */}
              {selectedCollection !== 'random' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product (optional)</label>
                  <Select
                    value={selectedProduct}
                    onValueChange={setSelectedProduct}
                    disabled={loadingProducts}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingProducts ? 'Loading...' : 'Any product'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any product in collection</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.handle} value={p.handle}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProduct !== 'any' && products.find(p => p.handle === selectedProduct) && (
                    <div className="p-3 rounded-lg bg-muted text-sm">
                      <p className="font-medium">{products.find(p => p.handle === selectedProduct)?.title}</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {products.find(p => p.handle === selectedProduct)?.variants.length} variants available
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Button onClick={generateTopics} disabled={loading} className="w-full">
                {loading ? 'Generating Topics...' : 'Generate Topics'}
              </Button>

              {collectionInfo && (
                <p className="text-sm text-muted-foreground">
                  Topics for: <span className="font-medium">{collectionInfo.name}</span>
                </p>
              )}

              {/* Topic Options */}
              {topics.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Select a topic:</p>
                  {topics.map((topic, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedTopic(topic)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedTopic === topic
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <h3 className="font-medium">{topic.topic}</h3>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Badge variant="secondary">{topic.primaryKeyword}</Badge>
                        <Badge variant="outline">{topic.angle}</Badge>
                        <Badge variant="outline">{topic.searchIntent}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{topic.uniqueAngle}</p>
                      {topic.relevantProducts && topic.relevantProducts.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Products: {topic.relevantProducts.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={generateTopics} disabled={loading}>
                      Regenerate
                    </Button>
                    <Button onClick={generateOutline} disabled={!selectedTopic || loading}>
                      {loading ? 'Creating outline...' : 'Next →'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Outline */}
        {step === 2 && outline && (
          <Card>
            <CardHeader>
              <CardTitle>2. Outline</CardTitle>
              <CardDescription>{outline.meta.targetWordCount} words target</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {outline.sections.map((s, i) => (
                  <div key={i} className="p-3 rounded bg-muted">
                    <p className="font-medium">{s.heading}</p>
                    <ul className="mt-1 text-sm text-muted-foreground">
                      {s.keyPoints.slice(0, 2).map((p, j) => (
                        <li key={j}>• {p}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                + {outline.faqSection.questions.length} FAQs
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  ← Back
                </Button>
                <Button onClick={() => setStep(3)}>Next →</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Context */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>3. Add Context</CardTitle>
              <CardDescription>Optional notes for the AI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Add any specific instructions...&#10;&#10;Examples:&#10;- Focus on safety&#10;- Compare with other products&#10;- Target industrial use cases"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={6}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  ← Back
                </Button>
                <Button onClick={generateContent} disabled={loading}>
                  {loading ? 'Generating...' : 'Generate Content →'}
                </Button>
              </div>
              {loading && (
                <p className="text-sm text-muted-foreground text-center">
                  This may take a minute...
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Done */}
        {step === 4 && post && (
          <Card>
            <CardHeader>
              <CardTitle>4. Done!</CardTitle>
              <CardDescription>Your post has been created</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <h3 className="font-semibold">{post.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{post.summary}</p>
                <p className="text-xs text-muted-foreground mt-2">{post.wordCount} words</p>
              </div>
              <div className="flex gap-2">
                <Button asChild>
                  <a href={`/admin/posts/${post.id}`}>Edit Draft</a>
                </Button>
                <Button variant="outline" onClick={reset}>
                  Create Another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
