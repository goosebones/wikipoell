// A box to paste an article code into, opening /decode?code=… with its
// explanation. A plain form, so it works without JavaScript.
// Props: defaultValue (the code already in the box, if any).
import Form from "next/form";
import { Button } from "@/components/ui/button";

export function DecodeForm({ defaultValue }: { defaultValue?: string }) {
  return (
    <Form
      action="/decode"
      className="flex max-w-md gap-2"
    >
      <input
        name="code"
        defaultValue={defaultValue}
        placeholder="e.g. AM/2600-LR ROOMS/010"
        aria-label="Article code"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 rounded-md bg-muted px-3 py-2 font-mono text-[14px] uppercase outline-none placeholder:normal-case"
      />
      <Button type="submit">Decode</Button>
    </Form>
  );
}
