/**
 * Alliance Chemical Blog CSS Template
 * Extracted from existing blog examples
 */

export const BLOG_CSS = `
:root {
    --ac-primary: #673AB7;
    --ac-secondary: #8E44AD;
    --ac-accent: #9C27B0;
    --ac-dark: #212529;
    --ac-text: #343A40;
    --ac-muted: #6c757d;
    --ac-bg: #F8F9FA;
    --ac-card: #FFFFFF;
    --ac-border: #DEE2E6;
    --ac-radius: 10px;
    --ac-shadow: 0 6px 22px rgba(33,37,41,.08);
    --ac-danger: #c0392b;
    --ac-warning: #f39c12;
    --ac-success: #27ae60;
    --ac-info-bg: #EAF2F8;
    --ac-info-border: #2980B9;
    --ac-info-text: #1B4F72;
    --ac-warning-bg: #FEF5E7;
    --ac-warning-border: #F39C12;
    --ac-warning-text: #7D6608;
    --ac-danger-bg: #FADBD8;
    --ac-danger-border: #C0392B;
    --ac-danger-text: #641E16;
    --ac-success-bg: #E8DAEF;
    --ac-success-border: #8E44AD;
    --ac-success-text: #4A235A;
}

*, *:before, *:after { box-sizing: border-box; }

body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Inter, Arial, sans-serif;
    line-height: 1.7;
    color: var(--ac-text);
    background: var(--ac-bg);
    font-size: 17px;
}

/* Hero Section */
.ac-hero {
    position: relative;
    isolation: isolate;
    color: #fff;
    text-align: center;
    padding: 5rem 1.5rem 10rem;
    background: linear-gradient(rgba(103,58,183,.92), rgba(142,68,173,.88)),
                var(--hero-image, none) center/cover no-repeat;
    clip-path: polygon(0 0, 100% 0, 100% 94%, 0 100%);
}

.ac-hero h1 {
    font-weight: 800;
    letter-spacing: .2px;
    margin: 0 0 8px;
    font-size: clamp(2.2rem, 5vw, 3.2rem);
    text-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.5);
}

.ac-hero p {
    max-width: 900px;
    margin: 0 auto 1.2rem;
    font-size: clamp(1rem, 2.2vw, 1.25rem);
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

/* Trust Badges */
.trust-badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: .6rem .8rem;
    margin-top: 1.5rem;
}

.badge {
    background: rgba(255,255,255,0.15);
    backdrop-filter: blur(10px);
    padding: .5rem 1rem;
    border-radius: 25px;
    border: 1px solid rgba(255,255,255,0.25);
    font-size: 0.9rem;
    font-weight: 600;
    color: #fff;
}

/* Main Content Section */
.ac-section {
    max-width: 900px;
    margin: -6rem auto 2rem;
    background: var(--ac-card);
    border: 1px solid var(--ac-border);
    border-radius: var(--ac-radius);
    box-shadow: var(--ac-shadow);
    padding: 2rem;
}

.ac-section h2 {
    font-size: clamp(1.6rem, 3.2vw, 2.2rem);
    color: var(--ac-primary);
    margin: .2rem 0 1rem;
    padding-bottom: .6rem;
    border-bottom: 3px solid var(--ac-secondary);
}

.ac-section h3 {
    font-size: clamp(1.25rem, 2.4vw, 1.6rem);
    color: var(--ac-secondary);
    margin: 1.8rem 0 .6rem;
    border-left: 5px solid var(--ac-primary);
    padding-left: 1rem;
}

.ac-section h4 {
    font-size: 1.1rem;
    color: var(--ac-primary);
    margin: 1.5rem 0 .5rem;
}

.ac-section p {
    margin-bottom: 1.2rem;
    line-height: 1.8;
}

.ac-section ul, .ac-section ol {
    margin: 1.5rem 0;
    padding-left: 1.5rem;
}

.ac-section li {
    margin-bottom: 0.8rem;
    line-height: 1.7;
}

.ac-section a {
    color: var(--ac-primary);
    font-weight: 600;
    text-decoration: none;
    border-bottom: 2px dotted var(--ac-secondary);
}

.ac-section a:hover {
    border-bottom-style: solid;
}

strong {
    color: var(--ac-text);
    font-weight: 600;
}

/* Callout Boxes */
.ac-callout {
    border-left: 6px solid var(--ac-info-border);
    background: var(--ac-info-bg);
    color: var(--ac-info-text);
    border-radius: 8px;
    padding: 1rem 1.2rem;
    margin: 1.5rem 0;
}

.ac-callout h4 {
    margin: .2rem 0 .4rem;
    color: inherit;
    font-size: 1.1rem;
    border: none;
    padding: 0;
}

.ac-callout.warning {
    border-left-color: var(--ac-warning-border);
    background: var(--ac-warning-bg);
    color: var(--ac-warning-text);
}

.ac-callout.danger {
    border-left-color: var(--ac-danger-border);
    background: var(--ac-danger-bg);
    color: var(--ac-danger-text);
}

.ac-callout.success {
    border-left-color: var(--ac-success-border);
    background: var(--ac-success-bg);
    color: var(--ac-success-text);
}

/* Tables */
table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin: 2rem 0;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

th {
    background: linear-gradient(135deg, #673AB7, #8E44AD);
    color: white;
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.9rem;
}

td {
    padding: 0.8rem 1rem;
    border-bottom: 1px solid var(--ac-border);
    background: white;
    font-size: 0.95rem;
}

tbody tr:last-child td {
    border-bottom: none;
}

tbody tr:hover {
    background: #f8f9fa;
}

tbody tr.highlight-row td {
    background-color: #f3e5f5;
}

/* Comparison Grid */
.comparison-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    margin: 2rem 0;
}

.comparison-card {
    background: white;
    border: 2px solid var(--ac-border);
    border-radius: 10px;
    padding: 1.5rem;
    transition: transform 0.2s, box-shadow 0.2s;
}

.comparison-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 20px rgba(103, 58, 183, 0.15);
}

.comparison-card h4 {
    color: #673AB7;
    margin-bottom: 1rem;
    font-size: 1.2rem;
}

.comparison-card.featured {
    border-color: #673AB7;
    background: linear-gradient(135deg, #f3e5f5, #e8daef);
}

/* Case Study Box */
.case-study {
    background: linear-gradient(135deg, #f3e5f5, #ffffff);
    border: 2px solid var(--ac-primary);
    border-radius: var(--ac-radius);
    padding: 1.5rem;
    margin: 2rem 0;
}

.case-study h4 {
    color: var(--ac-primary);
    margin: 0 0 1rem;
    font-size: 1.3rem;
    border: none;
    padding: 0;
}

.case-study .stats {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin: 1rem 0;
}

.case-study .stat {
    flex: 1;
    min-width: 140px;
    text-align: center;
    padding: 1rem;
    background: var(--ac-card);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.case-study .stat-number {
    font-size: 2rem;
    font-weight: 800;
    color: var(--ac-primary);
}

.case-study .stat-label {
    font-size: 0.85rem;
    color: var(--ac-muted);
    margin-top: 0.25rem;
}

/* Process Steps */
.process-steps {
    counter-reset: step-counter;
    margin: 2rem 0;
}

.process-step {
    counter-increment: step-counter;
    margin-bottom: 2rem;
    padding-left: 4rem;
    position: relative;
}

.process-step::before {
    content: counter(step-counter);
    position: absolute;
    left: 0;
    top: 0;
    width: 2.5rem;
    height: 2.5rem;
    background: linear-gradient(135deg, #673AB7, #8E44AD);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.2rem;
}

.process-step h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    color: var(--ac-secondary);
    border: none;
    padding: 0;
}

/* Product Grid */
.product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    margin: 1.5rem 0;
}

.product-card {
    background: var(--ac-bg);
    border: 1px solid var(--ac-border);
    border-radius: var(--ac-radius);
    padding: 1.5rem;
    transition: transform 0.2s, box-shadow 0.2s;
}

.product-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--ac-shadow);
}

.product-card h4 {
    color: var(--ac-primary);
    margin: 0 0 .5rem;
    border: none;
    padding: 0;
}

.product-card p {
    margin: 0;
    font-size: 0.95rem;
    color: var(--ac-muted);
}

/* CTA Section */
.cta-section {
    background: linear-gradient(135deg, var(--ac-primary), var(--ac-secondary));
    color: white;
    border-radius: var(--ac-radius);
    padding: 2.5rem;
    text-align: center;
    margin: 2.5rem 0;
}

.cta-section h3 {
    color: white;
    margin: 0 0 1rem;
    font-size: 1.5rem;
    border: none;
    padding: 0;
}

.cta-section p {
    margin: 0 0 1.5rem;
    opacity: 0.95;
}

.cta-button {
    display: inline-block;
    background: white;
    color: var(--ac-primary);
    padding: .8rem 2rem;
    border-radius: 30px;
    font-weight: 700;
    text-decoration: none;
    transition: transform 0.2s, box-shadow 0.2s;
    border: none;
}

.cta-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.2);
}

/* Author Box */
.ac-author-box {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
    background: var(--ac-bg);
    padding: 1.5rem;
    border-radius: var(--ac-radius);
    margin-top: 2rem;
}

.ac-author-box img {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--ac-card);
}

.ac-author-box h4 {
    color: var(--ac-primary);
    margin: 0 0 .25rem;
    font-size: 1.25rem;
    border: none;
    padding: 0;
}

.ac-author-box p {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.6;
}

/* Images */
.ac-img-container {
    margin: 2.5rem auto;
    max-width: 700px;
}

.ac-img-container img {
    width: 100%;
    height: auto;
    border-radius: var(--ac-radius);
    box-shadow: var(--ac-shadow);
}

.ac-img-caption {
    text-align: center;
    font-style: italic;
    font-size: 0.95rem;
    color: var(--ac-muted);
    margin-top: 1rem;
}

.ac-img-wide {
    margin: 3rem auto;
    max-width: 900px;
}

/* Image Placeholder */
.ac-img-placeholder {
    background: linear-gradient(135deg, #f3e5f5, #e8daef);
    border: 2px dashed var(--ac-primary);
    border-radius: var(--ac-radius);
    padding: 2rem;
    text-align: center;
    color: var(--ac-primary);
    margin: 2rem 0;
}

.ac-img-placeholder p {
    margin: 0;
    font-style: italic;
}

/* Credentials Box */
.credentials-box {
    background: var(--ac-bg);
    border: 2px solid #673AB7;
    border-radius: 12px;
    padding: 2rem;
    margin: 2rem 0;
}

.credentials-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.credentials-icon {
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #673AB7, #8E44AD);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.5rem;
    font-weight: bold;
}

/* FAQ Section */
.faq-section {
    margin: 2rem 0;
}

.faq-item {
    border: 1px solid var(--ac-border);
    border-radius: 8px;
    margin-bottom: 1rem;
    overflow: hidden;
}

.faq-question {
    background: var(--ac-bg);
    padding: 1rem 1.5rem;
    font-weight: 600;
    color: var(--ac-primary);
}

.faq-answer {
    padding: 1rem 1.5rem;
    background: white;
}

/* Footer */
.ac-footer {
    margin: 3rem 0 2rem;
    padding: 2rem;
    background: var(--ac-bg);
    border-radius: 12px;
    text-align: center;
    font-size: 0.9rem;
    color: var(--ac-muted);
}

/* Utilities */
.ac-note {
    font-size: .95rem;
    color: var(--ac-muted);
}

.ac-badge {
    display: inline-block;
    padding: .25rem .6rem;
    border-radius: 999px;
    background: #e8daef;
    color: #673ab7;
    font-weight: 700;
    font-size: .85rem;
}

/* Responsive */
@media (max-width: 768px) {
    .ac-hero { padding: 3rem 1rem 6rem; }
    .ac-section { padding: 1.5rem; margin-top: -4rem; }
    .comparison-grid { grid-template-columns: 1fr; }
    .process-step { padding-left: 3rem; }
    .process-step::before { width: 2rem; height: 2rem; font-size: 1rem; }
    table { font-size: 0.85rem; }
    th, td { padding: 0.6rem 0.8rem; }
    .ac-author-box { flex-direction: column; align-items: center; text-align: center; }
}
`;

export default BLOG_CSS;
