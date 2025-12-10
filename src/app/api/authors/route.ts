/**
 * Authors API
 *
 * GET /api/authors - List all authors
 * POST /api/authors - Create new author
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { authors } from '@/lib/db/schema';
import { z } from 'zod';

const CreateAuthorSchema = z.object({
  name: z.string().min(2).max(100),
  role: z.string().min(2).max(100),
  credentials: z.string().min(10).max(500),
  profileUrl: z.string().url().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
});

/**
 * GET /api/authors
 * List all authors
 */
export async function GET() {
  try {
    const allAuthors = await db.query.authors.findMany({
      orderBy: (authors, { asc }) => [asc(authors.name)],
    });

    return NextResponse.json({ authors: allAuthors });
  } catch (error) {
    console.error('Error listing authors:', error);
    return NextResponse.json(
      { error: 'Failed to list authors' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/authors
 * Create a new author
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = CreateAuthorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const [newAuthor] = await db
      .insert(authors)
      .values({
        name: data.name,
        role: data.role,
        credentials: data.credentials,
        profileUrl: data.profileUrl,
        avatarUrl: data.avatarUrl,
        bio: data.bio,
      })
      .returning();

    return NextResponse.json({ author: newAuthor }, { status: 201 });
  } catch (error) {
    console.error('Error creating author:', error);
    return NextResponse.json(
      { error: 'Failed to create author' },
      { status: 500 }
    );
  }
}
