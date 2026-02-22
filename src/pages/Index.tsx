import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";
import FilmCard from "@/components/FilmCard";
import heroImage from "@/assets/hero-film.jpg";

const mockFilms = [
  { id: "1", title: "Midnight in Vienna", timePeriod: "1920s", shotCount: 42, memberCount: 3 },
  { id: "2", title: "Neon Requiem", timePeriod: "2087", shotCount: 18, memberCount: 2 },
  { id: "3", title: "The Last Projector", timePeriod: "1970s", shotCount: 67, memberCount: 5 },
  { id: "demo", title: "Desert Horizons", timePeriod: "Present Day", shotCount: 24, memberCount: 4 },
];

const Index = () => {
  return (
    <AppLayout>
      <div className="flex flex-col">
        {/* Hero Banner */}
        <div className="relative h-48 overflow-hidden">
          <img src={heroImage} alt="Cinema" className="h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 flex items-center px-8">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">
                Virtual Film Studio
              </h1>
              <p className="mt-1 text-muted-foreground">
                Your AI-powered cinematic workspace
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Your Films</h2>
            <Button className="gap-2 cinema-shadow">
              <Plus className="h-4 w-4" />
              New Film
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mockFilms.map((film) => (
              <FilmCard key={film.id} {...film} />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
