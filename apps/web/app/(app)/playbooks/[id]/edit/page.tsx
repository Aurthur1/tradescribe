"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchPlaybook, type Playbook } from "../../../_lib/dashboard-data";
import { SAMPLE_PLAYBOOKS } from "../../../_lib/dashboard-sample";
import { PlaybookForm } from "../../_components/playbook-form";

export default function EditPlaybookPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const sample = SAMPLE_PLAYBOOKS.find((playbook) => playbook.id === id);
  const [playbook, setPlaybook] = useState<Playbook | null>(sample ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sample) return;
    const controller = new AbortController();
    fetchPlaybook(id, controller.signal)
      .then(setPlaybook)
      .catch(() => setError("Playbook could not be loaded."));
    return () => controller.abort();
  }, [id, sample]);

  if (sample) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/80 p-8">
          <h1 className="text-xl font-bold text-white">Sample playbooks are read-only.</h1>
          <Link className="mt-4 inline-flex text-sm font-bold text-[#93C5FD]" href="/playbooks/new">Create a real playbook</Link>
        </div>
      </div>
    );
  }

  if (!playbook) {
    return <div className="grid h-full place-items-center text-sm font-semibold text-[#94A3B8]">{error ?? "Loading playbook..."}</div>;
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-5 py-6 sm:px-8">
      <PlaybookForm mode="edit" playbook={playbook} />
    </div>
  );
}
