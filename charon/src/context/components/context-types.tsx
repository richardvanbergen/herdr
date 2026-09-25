import type { ComponentProps } from "react";
import { Textarea } from "#/components/ui/textarea";

function TextContextBody(props: ComponentProps<typeof Textarea>) {
	return <Textarea {...props} className="min-h-48" />;
}

// Each future context type supplies its own body editor.
export const contextTypes = {
	text: { label: "Text", Editor: TextContextBody },
} as const;
