import { ClientSiteFilterSelect, type ClientSiteFilterOption } from "@/components/shared/ClientSiteFilterSelect";

type AgentRunsHeaderSiteFilterProps = {
  value: string;
  options: ClientSiteFilterOption[];
  onChange: (siteId: string) => void;
};

export function AgentRunsHeaderSiteFilter({
  value,
  options,
  onChange,
}: AgentRunsHeaderSiteFilterProps) {
  if (options.length === 0) return null;

  return (
    <ClientSiteFilterSelect
      value={value}
      options={options}
      onChange={onChange}
      className="agent-runs-header-site-filter agent-runs-client-header__site-filter"
      contentClassName="agent-runs-site-filter-panel"
      contentLayout="drawerRow"
      ariaLabel="Client site"
    />
  );
}
