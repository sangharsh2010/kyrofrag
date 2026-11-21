import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { BannerItem, BannerTargetPage } from '../types/esports';

interface BannerStripProps {
  banners: BannerItem[];
  page: Exclude<BannerTargetPage, 'All Pages'>;
}

export const BannerStrip: React.FC<BannerStripProps> = ({ banners, page }) => {
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});

  const visibleBanners = banners.filter(
    (b) =>
      b.imageUrl &&
      !failedIds[b.id] &&
      (b.targetPage === 'All Pages' || b.targetPage === page)
  );

  if (visibleBanners.length === 0) return null;

  return (
    <div
      className={`grid gap-3 ${
        visibleBanners.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
      }`}
    >
      {visibleBanners.map((banner) => {
        const href = (banner.targetUrl || '').trim() || '#';
        const isClickable = href !== '#';
        return (
          <a
            key={banner.id}
            href={href}
            target={isClickable ? '_blank' : undefined}
            rel={isClickable ? 'noopener noreferrer' : undefined}
            onClick={(e) => {
              if (!isClickable) e.preventDefault();
            }}
            className="group relative block rounded-2xl overflow-hidden bg-[#151A23] border border-white/10 hover:border-[#00FF88]/50 transition glow-green-sm"
          >
            <div className="aspect-[16/6] w-full max-h-44 overflow-hidden bg-[#0B0E14]">
              <img
                src={banner.imageUrl}
                alt={`Tournament promotion banner for ${banner.targetPage}`}
                loading="lazy"
                onError={() =>
                  setFailedIds((prev) => ({
                    ...prev,
                    [banner.id]: true,
                  }))
                }
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
              />
            </div>
            {isClickable && (
              <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-[#0B0E14]/85 backdrop-blur-sm border border-[#00FF88]/40 text-[11px] font-bold uppercase tracking-wider text-[#00FF88] inline-flex items-center gap-1 opacity-90 group-hover:opacity-100">
                Open
                <ExternalLink className="w-3 h-3" />
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
};
