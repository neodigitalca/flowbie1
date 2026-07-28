import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type WordPressSite } from "../types";
import { SitePropertyFormFields } from "./SitePropertyFormFields";

interface SiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  onFormNameChange: (value: string) => void;
  onFormSiteUrlChange: (value: string) => void;
  onFormProductionSiteUrlChange: (value: string) => void;
  onFormUsernameChange: (value: string) => void;
  onFormAppPasswordChange: (value: string) => void;
  onFormGa4PropertyIdChange: (value: string) => void;
  onFormGbpLocationIdChange: (value: string) => void;
  onFormSemrushSiteAuditProjectIdChange: (value: string) => void;
  onFormEditorialCountsPeriodStartYmdChange: (value: string) => void;
  onFormOptimizationPackageChange: (value: string) => void;
  onFormBenchmarkCustomTagChange: (value: string) => void;
  onSave: () => void;
  onPatchSite?: (siteId: string, patch: Partial<WordPressSite>) => void;
}

export const SiteDialog: React.FC<SiteDialogProps> = ({
  open,
  onOpenChange,
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
  onSave,
  onPatchSite,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto bg-card font-sans text-base text-foreground">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            {editingSite ? "Edit WordPress Site" : "Add WordPress Site"}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground whitespace-normal break-words">
            Enter your WordPress site details. Use an Application Password for authentication.
          </DialogDescription>
        </DialogHeader>
        <SitePropertyFormFields
          chrome="light"
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
          onPatchSite={onPatchSite}
          patchSiteId={editingSite?.id ?? null}
          semrushActionsDisabled={editingSite?.enabled === false}
          className="py-2"
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-red-400 text-red-400 hover:bg-red-400/10"
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSave} className="bg-primary font-bold text-primary-foreground hover:bg-primary/90">
            {editingSite ? "Update" : "Add"} Site
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
