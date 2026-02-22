import { Film, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FilmCardProps {
  id: string;
  title: string;
  timePeriod: string;
  shotCount: number;
  memberCount: number;
  thumbnail?: string;
}

const FilmCard = ({ id, title, timePeriod, shotCount, memberCount, thumbnail }: FilmCardProps) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/workspace/${id}`)}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-all duration-300 hover:border-primary/30 cinema-shadow hover:cinema-glow"
    >
      <div className="relative h-40 overflow-hidden bg-secondary">
        {thumbnail ? (
          <img src={thumbnail} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
          {title}
        </h3>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {timePeriod}
          </span>
          <span className="flex items-center gap-1.5">
            <Film className="h-3.5 w-3.5" />
            {shotCount} shots
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {memberCount}
          </span>
        </div>
      </div>

      <div className="absolute right-3 top-3 rounded-md bg-secondary/80 px-2 py-1 text-xs font-medium text-primary backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100">
        Open →
      </div>
    </button>
  );
};

export default FilmCard;
