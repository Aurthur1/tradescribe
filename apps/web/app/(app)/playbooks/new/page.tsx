import { PlaybookForm } from "../_components/playbook-form";

export default function NewPlaybookPage() {
  return (
    <div className="h-full min-h-0 overflow-y-auto px-5 py-6 sm:px-8">
      <PlaybookForm mode="create" />
    </div>
  );
}
