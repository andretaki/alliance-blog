import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/write" className="font-semibold">
            Blog
          </Link>
          <div className="flex gap-6 text-sm">
            <Link href="/write" className="text-muted-foreground hover:text-foreground">
              Write
            </Link>
            <Link href="/admin/posts" className="text-muted-foreground hover:text-foreground">
              Posts
            </Link>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto py-8 px-4">
        {children}
      </main>
    </div>
  );
}
