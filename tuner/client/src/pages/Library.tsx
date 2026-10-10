import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { setNexusContext } from "../components/NexusPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Library as LibraryIcon, Search, Upload, Trash2, ExternalLink, FileText } from "lucide-react";

interface Resource {
  id: number;
  title: string;
  author: string | null;
  tags: string | null;
  notes: string | null;
  filename: string;
  mime: string;
  size: number;
  pageCount: number;
  textPages: number;
  createdAt: string;
}

interface Hit {
  resourceId: number;
  title: string;
  author: string | null;
  page: number;
  snippet: string;
}

// Search snippets mark matches with \u0001 … \u0002; render them as <mark>
// without ever treating the text as HTML.
function Snippet({ text }: { text: string }) {
  const parts = text.replace(/\s*\n\s*/g, " ").split(/(\u0001[^\u0002]*\u0002)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("\u0001") ? (
          <mark key={i} className="bg-primary/25 text-foreground rounded px-0.5">
            {part.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

const fileUrl = (id: number, page?: number) => `/api/library/${id}/file${page ? `#page=${page}` : ""}`;

function titleFromFilename(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export default function Library() {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => {
    setNexusContext("Library — the practitioner's private books and notes, searchable and used by Nexus for citations");
    return () => setNexusContext("Frequency toolkit — OM Tuner");
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: ["/api/library"],
    queryFn: () => apiRequest("GET", "/api/library").then((r) => r.json()),
  });

  const { data: hits = [], isFetching: searching } = useQuery<Hit[]>({
    queryKey: ["/api/library/search", debounced],
    queryFn: () =>
      apiRequest("GET", `/api/library/search?q=${encodeURIComponent(debounced)}`).then((r) => r.json()),
    enabled: debounced.length > 1,
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file first.");
      const params = new URLSearchParams({ title: title.trim(), author: author.trim(), tags: tags.trim(), filename: file.name });
      const res = await fetch(`/api/library?${params}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Upload failed.");
      return body as { title: string; pageCount: number; textPages: number };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      queryClient.invalidateQueries({ queryKey: ["/api/library/search"] });
      const imageOnly = r.pageCount - r.textPages;
      toast({
        title: `Added: ${r.title}`,
        description:
          `${r.textPages} of ${r.pageCount} pages are searchable.` +
          (imageOnly > 0 ? ` ${imageOnly} look like images or diagrams and aren't searchable yet.` : ""),
      });
      setFile(null);
      setTitle("");
      setAuthor("");
      setTags("");
      if (fileInput.current) fileInput.current.value = "";
    },
    onError: (err: Error) => toast({ title: "Couldn't add the file", description: err.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/library/${id}`).then((r) => r.json()),
    onSuccess: (_d, id) => {
      const name = resources.find((r) => r.id === id)?.title;
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      queryClient.invalidateQueries({ queryKey: ["/api/library/search"] });
      setConfirmDelete(null);
      toast({ title: name ? `Removed: ${name}` : "Removed" });
    },
    onError: () => toast({ title: "Couldn't remove it", variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <PageHeader
        icon={<LibraryIcon className="w-5 h-5" />}
        title="Library"
        description="Your private reference shelf. Add books and notes, search them for exact passages, and Nexus will cite them (title and page) when they help answer a question. Only you can see the library; it is never shown to clients."
      />

      {/* Search */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library, e.g. Earth year 136.10 Hz"
            aria-label="Search your library"
            className="pl-9 bg-background border-white/20"
            data-testid="input-library-search"
          />
        </div>
        {debounced.length > 1 && (
          <div className="space-y-2" data-testid="library-results">
            {searching && hits.length === 0 ? (
              <p className="text-xs text-muted-foreground">Searching…</p>
            ) : hits.length === 0 ? (
              <p className="text-xs text-muted-foreground">No passages match “{debounced}”.</p>
            ) : (
              hits.map((h, i) => (
                <a
                  key={`${h.resourceId}-${h.page}-${i}`}
                  href={fileUrl(h.resourceId, h.page)}
                  target="_blank"
                  rel="noopener"
                  className="block bg-card border border-white/10 hover:border-white/25 rounded-lg p-3 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span className="text-white font-medium truncate">{h.title}</span>
                    <span>· p. {h.page}</span>
                    <ExternalLink className="w-3 h-3 ml-auto shrink-0" />
                  </div>
                  <p className="text-sm text-white/90 leading-relaxed line-clamp-3">
                    <Snippet text={h.snippet} />
                  </p>
                </a>
              ))
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Resources */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Resources ({resources.length})
          </h2>
          {resources.length === 0 ? (
            <div className="bg-card border border-white/10 rounded-xl p-8 text-center">
              <p className="text-sm text-muted-foreground">No resources yet. Add your first book or notes on the right.</p>
            </div>
          ) : (
            resources.map((r) => (
              <div key={r.id} className="bg-card border border-white/10 rounded-xl p-4" data-testid={`library-resource-${r.id}`}>
                {confirmDelete === r.id ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-red-300">Remove from the library?</p>
                      <p className="text-sm text-white truncate">{r.title}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)} className="h-8 text-xs text-muted-foreground">
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => remove.mutate(r.id)}
                      disabled={remove.isPending}
                      className="h-8 text-xs bg-red-500/80 hover:bg-red-500 text-white"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {[r.author, `${r.pageCount} page${r.pageCount === 1 ? "" : "s"}`, r.textPages < r.pageCount ? `${r.textPages} searchable` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {r.tags && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {r.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <a
                      href={fileUrl(r.id)}
                      target="_blank"
                      rel="noopener"
                      className="p-1.5 text-muted-foreground hover:text-white rounded"
                      aria-label={`Open ${r.title}`}
                      title="Open"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => setConfirmDelete(r.id)}
                      className="p-1.5 text-muted-foreground hover:text-red-400 rounded"
                      aria-label={`Remove ${r.title}`}
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add a resource */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-white/10 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Add a resource</h3>
            <div className="space-y-2">
              <Label htmlFor="library-file" className="text-muted-foreground">File (PDF, .txt or .md)</Label>
              <Input
                id="library-file"
                ref={fileInput}
                type="file"
                accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f && !title) setTitle(titleFromFilename(f.name));
                }}
                className="bg-background border-white/20 text-sm"
                data-testid="input-library-file"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="library-title" className="text-muted-foreground">Title</Label>
              <Input id="library-title" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-background border-white/20" data-testid="input-library-title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="library-author" className="text-muted-foreground">Author (optional)</Label>
              <Input id="library-author" value={author} onChange={(e) => setAuthor(e.target.value)} className="bg-background border-white/20" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="library-tags" className="text-muted-foreground">Tags (optional, comma-separated)</Label>
              <Input id="library-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="frequencies, planets" className="bg-background border-white/20" />
            </div>
            <Button
              onClick={() => upload.mutate()}
              disabled={!file || !title.trim() || upload.isPending}
              className="w-full"
              data-testid="button-library-upload"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              {upload.isPending ? "Reading pages…" : "Add to library"}
            </Button>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Files stay on OM Tuner's private storage, behind your login. Pages that are only images (diagrams,
              tables) can't be searched yet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
