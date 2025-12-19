import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, List, Grid3X3, Plus, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Queue = () => {
  const navigate = useNavigate();
  const [view, setView] = useState("list");

  const EmptyState = () => (
    <div className="text-center py-16">
      <Clock className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
      <h3 className="text-xl font-display font-semibold mb-2">No scheduled posts</h3>
      <p className="text-muted-foreground mb-6">Start scheduling content to see it here</p>
      <Button onClick={() => navigate("/compose")} className="bg-gradient-primary hover:opacity-90">
        <Plus className="w-4 h-4 mr-2" /> Create Post
      </Button>
    </div>
  );

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">Queue</h1>
            <p className="text-muted-foreground mt-1">Manage your scheduled posts</p>
          </div>
          <Button onClick={() => navigate("/compose")} className="bg-gradient-primary hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" /> New Post
          </Button>
        </div>

        <Tabs value={view} onValueChange={setView}>
          <TabsList className="mb-6">
            <TabsTrigger value="list"><List className="w-4 h-4 mr-2" />List</TabsTrigger>
            <TabsTrigger value="grid"><Grid3X3 className="w-4 h-4 mr-2" />Grid</TabsTrigger>
            <TabsTrigger value="calendar"><Calendar className="w-4 h-4 mr-2" />Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="list"><Card><CardContent className="pt-6"><EmptyState /></CardContent></Card></TabsContent>
          <TabsContent value="grid"><Card><CardContent className="pt-6"><EmptyState /></CardContent></Card></TabsContent>
          <TabsContent value="calendar">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="aspect-square border border-border rounded-lg p-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                      {i < 31 ? i + 1 : ""}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Queue;
