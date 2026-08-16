import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TaskFormFieldGrid,
  TaskFormFlatGrid,
  TaskFormFlatSelectPlaceholder,
  TaskFormInfield,
  TaskFormInfieldSelect,
  TaskFormPlaceholderCell,
} from "@/components/manager/tasks/TaskFormLayout";
import { ensurePostCreatorPayload } from "@/lib/post-creator/post-creator-defaults";
import type { TaskExecutionPayload } from "@/lib/tasks-types";

const INLINE_INPUT_CLASS = "h-9 min-h-9 rounded-none border-0 bg-zinc-900 text-base";

export type PostCreatorExecutionFieldsProps = {
  executionPayload?: TaskExecutionPayload | null;
  disabled?: boolean;
  layout?: "stack" | "inline";
  onChange: (payload: TaskExecutionPayload) => void;
};

export function PostCreatorExecutionFields({
  executionPayload,
  disabled = false,
  layout = "stack",
  onChange,
}: PostCreatorExecutionFieldsProps): React.ReactElement {
  const payload = ensurePostCreatorPayload(executionPayload);
  const inline = layout === "inline";

  const patch = (partial: Partial<TaskExecutionPayload>) => {
    onChange(ensurePostCreatorPayload({ ...payload, ...partial }));
  };

  const postCount = payload.postCount ?? 1;
  const timesPerMonth = payload.scheduleTimesPerMonth ?? postCount;
  const startDay = payload.scheduleStartDay ?? 1;
  const keywordSource = payload.keywordSource ?? "prompt";

  if (inline) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1">
        <TaskFormFlatGrid className="grid-cols-2 md:grid-cols-4">
          <TaskFormPlaceholderCell className="min-w-0">
            <span className="whitespace-normal leading-tight text-base text-muted-foreground">Posts per run</span>
            <Input
              type="number"
              min={1}
              max={31}
              value={postCount}
              disabled={disabled}
              className={INLINE_INPUT_CLASS}
              onChange={(e) => patch({ postCount: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })}
            />
          </TaskFormPlaceholderCell>
          <TaskFormPlaceholderCell className="min-w-0">
            <span className="whitespace-normal leading-tight text-base text-muted-foreground">Times per month</span>
            <Input
              type="number"
              min={1}
              max={31}
              value={timesPerMonth}
              disabled={disabled}
              className={INLINE_INPUT_CLASS}
              onChange={(e) =>
                patch({ scheduleTimesPerMonth: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })
              }
            />
          </TaskFormPlaceholderCell>
          <TaskFormPlaceholderCell className="min-w-0">
            <span className="whitespace-normal leading-tight text-base text-muted-foreground">Start day</span>
            <Input
              type="number"
              min={1}
              max={28}
              value={startDay}
              disabled={disabled}
              className={INLINE_INPUT_CLASS}
              onChange={(e) => patch({ scheduleStartDay: Math.max(1, Math.min(28, Number(e.target.value) || 1)) })}
            />
          </TaskFormPlaceholderCell>
          <TaskFormPlaceholderCell className="min-w-0">
            <span className="whitespace-normal leading-tight text-base text-muted-foreground">Start time</span>
            <Input
              type="time"
              value={payload.scheduleStartTime ?? "09:00"}
              disabled={disabled}
              className={INLINE_INPUT_CLASS}
              onChange={(e) => patch({ scheduleStartTime: e.target.value.slice(0, 5) })}
            />
          </TaskFormPlaceholderCell>
        </TaskFormFlatGrid>
        <TaskFormFlatGrid className="grid-cols-2 md:grid-cols-3">
          <TaskFormFlatSelectPlaceholder
            placeholder="Keyword source"
            value={keywordSource}
            onChange={(v) => patch({ keywordSource: v as TaskExecutionPayload["keywordSource"] })}
            disabled={disabled}
            options={[
              { value: "prompt", label: "AI ideas" },
              { value: "gsc", label: "GSC performers" },
              { value: "manual", label: "Manual list" },
            ]}
          />
          <TaskFormFlatSelectPlaceholder
            placeholder="Destination"
            value={payload.postDestination ?? "wordpress"}
            onChange={(v) => patch({ postDestination: v as TaskExecutionPayload["postDestination"] })}
            disabled={disabled}
            options={[
              { value: "wordpress", label: "WordPress schedule" },
              { value: "draft", label: "Draft only" },
              { value: "bank", label: "Content bank" },
            ]}
          />
          <TaskFormPlaceholderCell className="flex min-w-0 items-center gap-2">
            <Checkbox
              id="post-creator-featured-inline"
              checked={payload.featuredImage !== false}
              disabled={disabled}
              onCheckedChange={(checked) => patch({ featuredImage: checked === true })}
            />
            <label htmlFor="post-creator-featured-inline" className="text-base text-white">
              AI featured image
            </label>
          </TaskFormPlaceholderCell>
        </TaskFormFlatGrid>
        {keywordSource === "prompt" ? (
          <TaskFormPlaceholderCell className="min-w-0">
            <span className="text-base text-muted-foreground">Topic prompt</span>
            <Textarea
              value={payload.optionalPrompt ?? ""}
              disabled={disabled}
              rows={2}
              className="min-h-[2.5rem] rounded-none border-0 bg-zinc-900 p-2 text-base text-white"
              onChange={(e) => patch({ optionalPrompt: e.target.value })}
            />
          </TaskFormPlaceholderCell>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TaskFormFieldGrid>
        <TaskFormInfield label="Posts per run">
          <Input
            type="number"
            min={1}
            max={31}
            value={postCount}
            disabled={disabled}
            className="bg-zinc-900 text-base"
            onChange={(e) => patch({ postCount: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })}
          />
        </TaskFormInfield>
        <TaskFormInfield label="Times per month">
          <Input
            type="number"
            min={1}
            max={31}
            value={timesPerMonth}
            disabled={disabled}
            className="bg-zinc-900 text-base"
            onChange={(e) =>
              patch({ scheduleTimesPerMonth: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })
            }
          />
        </TaskFormInfield>
      </TaskFormFieldGrid>
      <TaskFormFieldGrid>
        <TaskFormInfield label="Start day of month">
          <Input
            type="number"
            min={1}
            max={28}
            value={startDay}
            disabled={disabled}
            className="bg-zinc-900 text-base"
            onChange={(e) => patch({ scheduleStartDay: Math.max(1, Math.min(28, Number(e.target.value) || 1)) })}
          />
        </TaskFormInfield>
        <TaskFormInfield label="Start time">
          <Input
            type="time"
            value={payload.scheduleStartTime ?? "09:00"}
            disabled={disabled}
            className="bg-zinc-900 text-base"
            onChange={(e) => patch({ scheduleStartTime: e.target.value.slice(0, 5) })}
          />
        </TaskFormInfield>
      </TaskFormFieldGrid>
      <TaskFormFieldGrid>
        <TaskFormInfieldSelect
          label="Keyword source"
          value={keywordSource}
          disabled={disabled}
          options={[
            { value: "prompt", label: "AI ideas" },
            { value: "gsc", label: "GSC performers" },
            { value: "manual", label: "Manual list" },
          ]}
          onChange={(v) => patch({ keywordSource: v as TaskExecutionPayload["keywordSource"] })}
        />
        <TaskFormInfieldSelect
          label="Destination"
          value={payload.postDestination ?? "wordpress"}
          disabled={disabled}
          options={[
            { value: "wordpress", label: "WordPress schedule" },
            { value: "draft", label: "Draft only" },
            { value: "bank", label: "Content bank" },
          ]}
          onChange={(v) => patch({ postDestination: v as TaskExecutionPayload["postDestination"] })}
        />
      </TaskFormFieldGrid>
      {keywordSource === "prompt" ? (
        <TaskFormInfield label="Topic prompt">
          <Textarea
            value={payload.optionalPrompt ?? ""}
            disabled={disabled}
            rows={2}
            className="bg-zinc-900 text-base"
            onChange={(e) => patch({ optionalPrompt: e.target.value })}
          />
        </TaskFormInfield>
      ) : null}
      <div className="flex items-center gap-2">
        <Checkbox
          id="post-creator-featured-stack"
          checked={payload.featuredImage !== false}
          disabled={disabled}
          onCheckedChange={(checked) => patch({ featuredImage: checked === true })}
        />
        <label htmlFor="post-creator-featured-stack" className="text-base text-white">
          AI featured image
        </label>
      </div>
      <p className="text-base text-muted-foreground">Target bucket: Posts</p>
    </div>
  );
}
