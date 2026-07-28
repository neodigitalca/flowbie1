import React from "react";
import { SiteDialog } from "./SiteDialog";
import type { WordPressSite } from "../types";

export interface WordPressSiteFormDialogsProps {
  isDialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  editingSite: WordPressSite | null;
  formName: string;
  formSiteUrl: string;
  formProductionSiteUrl: string;
  formUsername: string;
  formAppPassword: string;
  formGa4PropertyId: string;
  formGbpLocationId: string;
  formSemrushSiteAuditProjectId: string;
  formEditorialCountsPeriodStartYmd: string;
  formOptimizationPackage: string;
  formBenchmarkCustomTag: string;
  onFormNameChange: (name: string) => void;
  onFormSiteUrlChange: (url: string) => void;
  onFormProductionSiteUrlChange: (url: string) => void;
  onFormUsernameChange: (username: string) => void;
  onFormAppPasswordChange: (password: string) => void;
  onFormGa4PropertyIdChange: (value: string) => void;
  onFormGbpLocationIdChange: (value: string) => void;
  onFormSemrushSiteAuditProjectIdChange: (value: string) => void;
  onFormEditorialCountsPeriodStartYmdChange: (value: string) => void;
  onFormOptimizationPackageChange: (value: string) => void;
  onFormBenchmarkCustomTagChange: (value: string) => void;
  onSaveSite: () => void;
  onPatchSite?: (siteId: string, patch: Partial<WordPressSite>) => void;
}

/** Add/Edit site only. Keyword selection is mounted in {@link WordPressOptimizationProvider}. */
export const WordPressDialogs: React.FC<WordPressSiteFormDialogsProps> = ({
  isDialogOpen,
  onDialogOpenChange,
  editingSite,
  formName,
  formSiteUrl,
  formProductionSiteUrl,
  formUsername,
  formAppPassword,
  formGa4PropertyId,
  formGbpLocationId,
  formSemrushSiteAuditProjectId,
  formEditorialCountsPeriodStartYmd,
  formOptimizationPackage,
  formBenchmarkCustomTag,
  onFormNameChange,
  onFormSiteUrlChange,
  onFormProductionSiteUrlChange,
  onFormUsernameChange,
  onFormAppPasswordChange,
  onFormGa4PropertyIdChange,
  onFormGbpLocationIdChange,
  onFormSemrushSiteAuditProjectIdChange,
  onFormEditorialCountsPeriodStartYmdChange,
  onFormOptimizationPackageChange,
  onFormBenchmarkCustomTagChange,
  onSaveSite,
  onPatchSite,
}) => {
  return (
    <SiteDialog
      open={isDialogOpen}
      onOpenChange={onDialogOpenChange}
      editingSite={editingSite}
      formName={formName}
      formSiteUrl={formSiteUrl}
      formProductionSiteUrl={formProductionSiteUrl}
      formUsername={formUsername}
      formAppPassword={formAppPassword}
      formGa4PropertyId={formGa4PropertyId}
      formGbpLocationId={formGbpLocationId}
      formSemrushSiteAuditProjectId={formSemrushSiteAuditProjectId}
      formEditorialCountsPeriodStartYmd={formEditorialCountsPeriodStartYmd}
      formOptimizationPackage={formOptimizationPackage}
      formBenchmarkCustomTag={formBenchmarkCustomTag}
      onFormNameChange={onFormNameChange}
      onFormSiteUrlChange={onFormSiteUrlChange}
      onFormProductionSiteUrlChange={onFormProductionSiteUrlChange}
      onFormUsernameChange={onFormUsernameChange}
      onFormAppPasswordChange={onFormAppPasswordChange}
      onFormGa4PropertyIdChange={onFormGa4PropertyIdChange}
      onFormGbpLocationIdChange={onFormGbpLocationIdChange}
      onFormSemrushSiteAuditProjectIdChange={onFormSemrushSiteAuditProjectIdChange}
      onFormEditorialCountsPeriodStartYmdChange={onFormEditorialCountsPeriodStartYmdChange}
      onFormOptimizationPackageChange={onFormOptimizationPackageChange}
      onFormBenchmarkCustomTagChange={onFormBenchmarkCustomTagChange}
      onSave={onSaveSite}
      onPatchSite={onPatchSite}
    />
  );
};
