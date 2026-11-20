import * as Label from "@radix-ui/react-label";
import * as Select from "@radix-ui/react-select";

type Option = { value: string; label: string };

type Props = {
  id: string;
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  testId?: string;
};

/** Accessible select used on Variables (replaces native &lt;select&gt; where practical). */
export function RadixSelectField({
  id,
  label,
  value,
  options,
  onChange,
  testId,
}: Props) {
  return (
    <div className="radix-select-field">
      <Label.Root htmlFor={id}>{label}</Label.Root>
      <Select.Root value={value} onValueChange={onChange}>
        <Select.Trigger
          id={id}
          className="radix-select-trigger"
          data-testid={testId}
          data-value={value}
          aria-label={label}
        >
          <Select.Value />
          <Select.Icon aria-hidden>▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="radix-select-content" position="popper">
            <Select.Viewport>
              {options.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  className="radix-select-item"
                >
                  <Select.ItemText>{opt.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
