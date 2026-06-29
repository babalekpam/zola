import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface FileUpsert {
  path: string;
  content: string;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const supabase = await createSupabaseServerClient();
  const body = (await req.json()) as { files: FileUpsert[] };
  if (!Array.isArray(body.files))
    return NextResponse.json({ error: "files required" }, { status: 400 });

  const rows = body.files.map((f) => ({
    project_id: projectId,
    path: f.path,
    content: f.content,
  }));

  const { error } = await supabase
    .from("project_files")
    .upsert(rows, { onConflict: "project_id,path" });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const supabase = await createSupabaseServerClient();
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path)
    return NextResponse.json({ error: "path required" }, { status: 400 });

  const { error } = await supabase
    .from("project_files")
    .delete()
    .eq("project_id", projectId)
    .eq("path", path);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
