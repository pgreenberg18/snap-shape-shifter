import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, LayoutTemplate, SlidersHorizontal } from "lucide-react";
import { ReactNode } from "react";

interface TriStateTabsProps {
  autoContent: ReactNode;
  templatesContent: ReactNode;
  customContent: ReactNode;
}

const TriStateTabs = ({ autoContent, templatesContent, customContent }: TriStateTabsProps) => {
  return (
    <Tabs defaultValue="auto" className="w-full">
      <TabsList className="w-full bg-secondary border border-border cinema-inset h-11">
        <TabsTrigger
          value="auto"
          className="flex-1 gap-2 font-display text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:cinema-glow"
        >
          <Sparkles className="h-4 w-4" />
          Auto
        </TabsTrigger>
        <TabsTrigger
          value="templates"
          className="flex-1 gap-2 font-display text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:cinema-glow"
        >
          <LayoutTemplate className="h-4 w-4" />
          Templates
        </TabsTrigger>
        <TabsTrigger
          value="custom"
          className="flex-1 gap-2 font-display text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:cinema-glow"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Custom
        </TabsTrigger>
      </TabsList>

      <TabsContent value="auto" className="mt-4 animate-fade-in">{autoContent}</TabsContent>
      <TabsContent value="templates" className="mt-4 animate-fade-in">{templatesContent}</TabsContent>
      <TabsContent value="custom" className="mt-4 animate-fade-in">{customContent}</TabsContent>
    </Tabs>
  );
};

export default TriStateTabs;
