# Alliance Chemical Blog Style Guide
## Deep-Cut Analysis of Writing Style, Structure & Visual Design

*Extracted from 92 imported blog posts with special attention to high-performing technical content*

---

## STYLE VARIANTS

Alliance Chemical uses **two primary style templates** depending on content type:

| Template | Use Case | Tone | Key Elements |
|----------|----------|------|--------------|
| **Technical Deep-Dive** | Data center cooling, industrial chemistry, complex processes | Expert field experience, "$X00K failure" hooks | Case studies with stats, process steps, danger callouts |
| **Maker/Hobbyist Guide** | PCB etching, DIY chemistry, hobbyist applications | Friendly expert, community connection | Customer stories, comparison tables, step-by-step tutorials |

Both templates share core brand elements but differ in opening hooks, callout styles, and narrative approach.

---

## 1. VOICE & PERSONA

### Author Voice: Andre Taki
- **Position**: Lead Sales Manager & Technical Specialist
- **Experience claim**: 15+ years in chemical industry
- **Tone**: Expert practitioner sharing hard-won field knowledge
- **Perspective**: "I've seen..." / "In my experience..." / "After 15+ years..."

### Voice Characteristics
```
✓ First-person plural for company ("we", "our team")
✓ Second-person direct address ("you", "your facility")
✓ Personal anecdotes from field experience
✓ Authoritative but accessible - explains technical concepts
✓ Safety-conscious - always includes warnings
✓ Solution-oriented - problems are followed by fixes
```

### Signature Phrases
- "After 15+ years solving these problems, here's what really happens..."
- "I've seen multi-million dollar facilities brought to their knees by..."
- "The facilities that never have emergencies are the ones that..."
- "The math never works out..."
- "This is non-negotiable—"
- "Based on my experience with..."

---

## 2. CONTENT STRUCTURE

### Standard Long-Form Post Structure (~2,500-6,000 words)

```
1. HERO SECTION
   - Dramatic hook (the problem/cost/failure)
   - Author byline with link to #author section
   - Quick-nav links to major sections
   - Badges (category tags)
   - Date/part indicator if series

2. OPENING HOOK
   - Real-world failure story or breaking news tie-in
   - The cost/stakes ("$200K coolant failure")
   - Why this matters NOW
   - Danger/warning callout box if relevant

3. TABLE OF CONTENTS (for 3000+ word posts)
   - Numbered anchor links
   - Clear hierarchy

4. BODY SECTIONS (each ~200-400 words)
   - H2 for major topics
   - H3 for subtopics within
   - Mix of:
     * Explanatory paragraphs
     * Bulleted lists (symptoms, warning signs, steps)
     * Numbered process steps
     * Comparison tables
     * Callout boxes (info, warning, danger)
     * Inline product links
     * Images with captions

5. CASE STUDIES SECTION
   - Real-world examples with:
     * Facility type/size
     * The mistake or challenge
     * Timeline of events
     * Stats boxes (cost, downtime, loss)
     * The lesson learned

6. ECONOMICS/ROI SECTION
   - Cost comparison tables
   - "Premium vs Economy" analysis
   - Payback calculations

7. PRODUCT RECOMMENDATIONS TABLE
   - Product | Application | Specification
   - Links to Alliance Chemical products

8. AUTHOR BOX
   - Photo placeholder
   - Name, title, credentials
   - Experience summary
   - Direct contact info

9. FOOTER/DISCLAIMER
   - Professional disclaimer
   - Company tagline
```

---

## 3. VISUAL DESIGN SYSTEM

### CSS Variables (Brand Colors)
```css
--ac-primary: #673AB7;      /* Purple - headers, accents */
--ac-secondary: #8E44AD;    /* Lighter purple - subheads */
--ac-dark: #212529;         /* Near-black text */
--ac-text: #343A40;         /* Body text */
--ac-muted: #6c757d;        /* Secondary text */
--ac-bg: #F8F9FA;           /* Light background */
--ac-card: #FFFFFF;         /* Card backgrounds */
--ac-border: #DEE2E6;       /* Borders */

/* Callout colors */
--ac-info-bg: #EAF2F8;      /* Blue info box */
--ac-info-border: #2980B9;
--ac-warning-bg: #FEF5E7;   /* Yellow warning */
--ac-warning-border: #F39C12;
--ac-danger-bg: #FADBD8;    /* Red danger */
--ac-danger-border: #C0392B;
```

### Hero Section Design
- Full-width gradient overlay on background image
- Large bold title with text shadow
- Subtitle/intro paragraph
- Navigation pills (rounded buttons linking to sections)
- Category badges
- Clip-path polygon for angled bottom edge

### Section Card Design
- Max-width ~980px, centered
- White background with subtle shadow
- Negative margin to overlap hero
- Rounded corners (10px)
- H2 with bottom border accent

### Heading Styles
```css
H1: 2.2-3.2rem, bold 800, centered, border-bottom accent
H2: 1.6-2.2rem, primary purple, border-bottom
H3: 1.25-1.6rem, secondary purple, left border accent (5px)
```

---

## 4. COMPONENT LIBRARY

### Callout Boxes

**Info Box** (blue) - Tips, pro tips, fun facts
```html
<div class="ac-callout">
  <h4>💡 Andre's Pro Tip</h4>
  <p>Content here...</p>
</div>
```

**Warning Box** (yellow) - Cautions, important notes
```html
<div class="ac-callout warning">
  <h4>⚠️ Warning Title</h4>
  <p>Content here...</p>
</div>
```

**Danger Box** (red) - Critical safety, breaking news, expensive mistakes
```html
<div class="ac-callout danger">
  <h4>🚨 Critical Alert</h4>
  <p>Content here...</p>
</div>
```

### Process Steps (Numbered circles)
```html
<div class="process-steps">
  <div class="process-step">
    <h4>Step Title</h4>
    <p>Description...</p>
  </div>
  <!-- Repeat for each step -->
</div>
```
- Auto-numbered with CSS counter
- Purple gradient circle with white number
- Left padding for step content

### Case Study Box
```html
<div class="case-study">
  <h4>Case Study: Title</h4>
  <p><strong>Facility:</strong> Description</p>
  <p><strong>The Mistake/Challenge:</strong> What happened</p>
  <div class="stats">
    <div class="stat">
      <div class="stat-number">$240K</div>
      <div class="stat-label">Cold Plate Replacements</div>
    </div>
    <!-- More stat boxes -->
  </div>
  <p><strong>The Lesson:</strong> Takeaway</p>
</div>
```

### Comparison Tables
```html
<table class="styled-table">
  <thead>
    <tr><th>Column 1</th><th>Column 2</th></tr>
  </thead>
  <tbody>
    <tr class="pro-row"><td>Good option</td><td>Details</td></tr>
    <tr class="con-row"><td>Bad option</td><td>Details</td></tr>
  </tbody>
</table>
```
- `pro-row` = green background
- `con-row` = red background

### Images
```html
<div class="ac-img-container"> <!-- Standard width ~700px -->
  <img src="..." alt="Descriptive alt text">
  <p class="ac-img-caption">Caption in italics</p>
</div>

<div class="ac-img-wide"> <!-- Wide format ~900px -->
  <img src="..." alt="...">
  <p class="ac-img-caption">Caption</p>
</div>
```

### Author Box
```html
<div class="ac-author-box">
  <img src="avatar.jpg" alt="Author Name">
  <div>
    <h4>Andre Taki</h4>
    <p><strong>Lead Sales Manager & Technical Specialist, Alliance Chemical</strong></p>
    <p>Bio text with experience and expertise...</p>
    <p><strong>Direct: (512) 365-6838</strong> | <strong>Email: sales@alliancechemical.com</strong></p>
  </div>
</div>
```

### Badges
```html
<div class="ac-flex ac-note">
  <span class="ac-badge">🤖 AI & Tech</span>
  <span class="ac-badge">🧪 Advanced Chemistry</span>
</div>
```

---

## 5. CONTENT PATTERNS

### Opening Hooks (First Paragraph Patterns)

**Pattern 1: The Costly Failure**
> "The $200K coolant failure. The silent corrosion killing uptime. The contamination nobody saw coming. After 15+ years solving these problems, here's what really happens in production environments."

**Pattern 2: Industry Transformation**
> "[Topic] has grown from a futuristic novelty into a technology that's transforming industries worldwide. From [use case A] to [use case B], [topic] has expanded far beyond [basic assumption]. But behind every [product/outcome] lies a lesser-known but incredibly important aspect: [chemistry/your angle]."

**Pattern 3: Breaking News Tie-In**
> "**[Date]** - [Recent event/news]. While [company] cited [their explanation], the event underscores a critical truth: **[bold insight connecting to your topic].**"

**Pattern 4: The Question Everyone Asks**
> "One of the most common questions I get: '[Customer question]?' The answer is almost always [X], and here's why."

### Transition Patterns

- "But theory only gets you so far. In the field, I've seen..."
- "This is the problem I see most often when..."
- "Based on my experience with [X], here's the essential..."
- "The facilities that never have [problem] are the ones that..."
- "One of the cardinal sins of [topic]..."
- "The math never works out..."

### Product Link Patterns

**Inline recommendation:**
> "This is non-negotiable—use ONLY high-purity **[Deionized Water](link)** for initial fill and all top-offs."

**In a list:**
> "For effective pre-cleaning before acid treatment, a powerful degreaser like **[d-Limonene](link)** can remove heavy oils."

**In a table:**
| Product | Application | Specification |
|---------|-------------|---------------|
| **[Ethylene Glycol - Inhibited](link)** | High-performance cooling | OAT/HOAT inhibitor, mix 40-50% |

### Safety Content Patterns

Always include safety boxes for chemical content:
```
⚠️ Essential Safety Notice
[Chemical] is a [hazard type] substance. Handle with care, and always follow
recommended guidelines to protect yourself, others, and your environment.
```

Standard safety elements to include:
- PPE requirements
- Ventilation requirements
- Storage requirements
- First aid notes
- SDS reference/link

### CTA Patterns

**Mid-article soft CTA:**
> "Explore our full range of [product category], including **[Product A](link)**, **[Product B](link)**, and **[Product C](link)** to [benefit]."

**End-of-article CTA box:**
```html
<div class="ac-callout">
  <h4>📞 Need Expert Guidance?</h4>
  <p>At Alliance Chemical, we've supplied [product type] and technical support
  to [audience] across North America for over 20 years...</p>
  <p><strong>Direct Line: (512) 365-6838</strong><br>
  Ask for Andre Taki. I personally respond to technical inquiries within one business day.</p>
</div>
```

---

## 6. TECHNICAL WRITING PATTERNS

### Chemical Formula Formatting
- Use subscript styling: H₂O, Fe₂O₃, NaOCl
- Include reaction equations centered with italics:
  > *Fe₂O₃ + 6 HCl → 2 FeCl₃ + 3 H₂O*

### Measurement Formatting
- Always include units: "0.8mm (about 1/32\")"
- Temperature: "120°C (248°F)" - both Celsius and Fahrenheit
- Concentration: "40-50% glycol"
- Currency: "$15K-25K" for ranges

### Specification Patterns
- pH ranges: "8.0-9.5"
- Conductivity: "below 10 μS/cm"
- Purity: "99.9%"
- Standards: "ASTM Type II minimum"

### Diagnostic/Troubleshooting Format
```
**Symptom:** [What user observes]
**Most Likely Cause:** [Root cause]
**Diagnostic Test:** [How to verify]
**Solution:** [What to do]
```

---

## 7. TARGET METRICS

Based on analysis of top-performing posts:

| Metric | Target Range |
|--------|--------------|
| Word count | 2,500 - 6,000 |
| Sections (H2) | 8 - 15 |
| Subsections (H3) | 15 - 40 |
| Product links | 8 - 15 |
| Images | 3 - 6 |
| Tables | 1 - 3 |
| Callout boxes | 3 - 6 |
| FAQs | 0 - 5 (optional) |

---

## 8. SEO & STRUCTURE REQUIREMENTS

### Title Format
- Length: 50-70 characters
- Include primary keyword
- Often uses colon structure: "Topic: Subtitle with Hook"
- Examples:
  - "Critical Metal Recovery 101: How to Refine Precious Metals Using Nitric Acid, Urea & More"
  - "The Unseen Chemistry of AI: How Cooling Systems Keep Data Centers Running"

### Meta Description
- 150-160 characters
- Include primary keyword
- Value proposition or key insight
- Action-oriented when possible

### Internal Linking Strategy
- Link to 8-15 Alliance Chemical products per post
- Use descriptive anchor text (product name, not "click here")
- Bold the linked product names
- Include links naturally in context, not just in product tables

### Schema/JSON-LD
- BlogPosting schema required
- Author schema with name, jobTitle, description
- Publisher (Organization) schema
- FAQ schema if FAQs included

---

## 9. IMAGE GUIDELINES

### Image Sources
- Use Shopify CDN URLs: `cdn.shopify.com/s/files/1/0588/2734/1866/files/...`
- Professional stock photos of:
  - Industrial facilities
  - Laboratory environments
  - Chemical products in use
  - Data centers (for tech content)
  - Manufacturing processes

### Required Alt Text
- Descriptive, keyword-relevant
- Example: "Modern data center server infrastructure" not "image1"

### Caption Style
- Italicized
- Explains relevance to article
- Example: "Modern hyperscale data centers house thousands of high-density servers—each generating tremendous heat that must be removed continuously"

---

## 10. BRAND TERMINOLOGY

### Always Use
- Alliance Chemical (not "Alliance" alone)
- Technical grade, ACS grade, USP grade, food grade
- Industrial strength, high purity, bulk
- "Inhibited" when referring to glycol products

### Product Naming Convention
- **[Product Name - Grade](link)**
- Example: **[Ethylene Glycol - Inhibited](link)**

### Contact Information
- Direct Line: (512) 365-6838
- Email: sales@alliancechemical.com
- Ask for Andre Taki

---

## APPENDIX: FULL CSS TEMPLATE

```css
/* See source files for complete CSS */
/* Key file: Data center cooling post styling */
```

The complete CSS block should be included at the top of every blog post inside a `<style>` tag for consistent rendering.
