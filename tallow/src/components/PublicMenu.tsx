import React, { useId, useState } from 'react';
import { MenuItem, MenuCategory } from '../types';
import { formatPrice } from '../lib/money';

interface PublicMenuProps {
  menuItems: MenuItem[];
  loading?: boolean;
  error?: string | null;
  onReserveForDish?: (dishName: string) => void;
  /**
   * 'page' is the standalone printed menu and owns the <h1>.
   * 'teaser' is embedded under a heading the homepage already wrote, so it
   * drops the masthead and the course filter and steps its headings down.
   */
  variant?: 'page' | 'teaser';
}

const CATEGORY_LABELS: Record<MenuCategory, { title: string; subtitle: string }> = {
  cuts: {
    title: 'THE CUTS',
    subtitle: 'Aged in-house over Himalayan rock salt, carved to order & seared over red oak',
  },
  starters: {
    title: 'STARTERS & HEARTH BITES',
    subtitle: 'Raw cuts, bone marrow & hearth roasted small plates',
  },
  sides: {
    title: 'SIDES',
    subtitle: 'Rendered tallow frying & ember-roasted vegetables',
  },
  sauces: {
    title: 'SAUCES & BUTTERS',
    subtitle: '72-hour reduced pan stocks and bone marrow emulsions',
  },
  desserts: {
    title: 'DESSERTS',
    subtitle: 'Smoked fats, dark chocolate & clotted creams',
  },
  drinks: {
    title: 'DRINKS & FAT-WASHED SPIRITS',
    subtitle: 'Aged whiskeys, tallow infusions & natural cellar wines',
  },
};

const CATEGORIES: MenuCategory[] = ['cuts', 'starters', 'sides', 'sauces', 'desserts', 'drinks'];

export const PublicMenu: React.FC<PublicMenuProps> = ({
  menuItems,
  loading = false,
  error = null,
  onReserveForDish,
  variant = 'page',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | 'all'>('all');
  const headingId = useId();

  const isTeaser = variant === 'teaser';
  // The teaser sits under the homepage's own <h2>, so its course headings are
  // one level deeper than they are on the standalone menu page.
  const CourseHeading = isTeaser ? 'h3' : 'h2';

  const visibleCategories = CATEGORIES.filter(
    (cat) => selectedCategory === 'all' || selectedCategory === cat
  );
  const visibleCount = menuItems.filter(
    (i) => selectedCategory === 'all' || i.category === selectedCategory
  ).length;

  const wrapperClass = isTeaser
    ? 'px-4 sm:px-8 max-w-5xl mx-auto'
    : 'py-12 sm:py-16 px-4 sm:px-8 max-w-5xl mx-auto paper-stock';

  if (error) {
    return (
      <section className={wrapperClass}>
        <div role="alert" className="max-w-xl mx-auto my-8 p-6 border border-[#7A2322] bg-[#7A2322]/5 text-center">
          <h2 className="font-display text-2xl text-[#1A1715] mb-2">The Menu Is Unavailable</h2>
          <p className="font-serif-body text-sm text-[#665E56]">{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className={wrapperClass} aria-labelledby={isTeaser ? undefined : headingId}>

      {/* Printed Menu Header */}
      {!isTeaser && (
        <div className="text-center mb-12 border-b-2 border-[#1A1715] pb-8">
          <span className="font-mono-data text-[10px] uppercase tracking-[0.3em] text-[#665E56] block mb-2">
            Daily Printed Menu · Evening Sittings
          </span>
          <h1 id={headingId} className="font-display text-4xl sm:text-6xl text-[#1A1715] tracking-tight">
            TALLOW
          </h1>
          <p className="font-serif-body text-sm sm:text-base text-[#665E56] max-w-xl mx-auto mt-2 italic">
            Prices inclusive of VAT. A discretionary 12.5% service charge is added to all bills.
          </p>

          {/* Filter Bar styled as printed index tags */}
          <div
            role="group"
            aria-label="Filter the menu by course"
            className="mt-8 flex flex-wrap justify-center gap-2 border-t border-b border-[#DDD6C8] py-3 text-xs font-mono-data uppercase tracking-wider"
          >
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              aria-pressed={selectedCategory === 'all'}
              className={`px-3 py-1 transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[#1A1715] text-[#F7F4EE]'
                  : 'text-[#665E56] hover:text-[#1A1715]'
              }`}
            >
              All Courses
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={selectedCategory === cat}
                className={`px-3 py-1 transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#1A1715] text-[#F7F4EE]'
                    : 'text-[#665E56] hover:text-[#1A1715]'
                }`}
              >
                {CATEGORY_LABELS[cat].title}
              </button>
            ))}
          </div>

          {/* Filtering rewrites the page below silently for a sighted user; this
              is the only thing that reports it to everyone else. */}
          <p aria-live="polite" className="sr-only">
            {loading ? 'Loading the menu' : `${visibleCount} selections shown`}
          </p>
        </div>
      )}

      {loading ? (
        <p className="py-16 text-center font-mono-data text-xs uppercase tracking-widest text-[#665E56]">
          Setting today's menu…
        </p>
      ) : menuItems.length === 0 ? (
        <p className="py-16 text-center font-serif-body text-sm italic text-[#665E56]">
          No selections are listed for this service.
        </p>
      ) : (
        <div className="space-y-16">
          {visibleCategories.map((cat) => {
            const courseItems = menuItems.filter((i) => i.category === cat);
            if (courseItems.length === 0) return null;

            // Photography is a per-course decision: a course either runs its
            // gutter column or it does not, so half-illustrated courses cannot
            // happen.
            const hasCoursePhotos = courseItems.some((i) => Boolean(i.photoUrl));

            return (
              <div key={cat} className="space-y-8">

                {/* Course Header Rule */}
                <div className="border-b border-[#38322D] pb-2 flex items-baseline justify-between">
                  <div>
                    <CourseHeading className="font-display text-2xl sm:text-3xl text-[#1A1715] tracking-wider uppercase">
                      {CATEGORY_LABELS[cat].title}
                    </CourseHeading>
                    <p className="text-xs font-serif-body text-[#665E56] italic">
                      {CATEGORY_LABELS[cat].subtitle}
                    </p>
                  </div>
                  <span className="font-mono-data text-xs text-[#755C38] uppercase tracking-widest">
                    {courseItems.length} {courseItems.length === 1 ? 'Selection' : 'Selections'}
                  </span>
                </div>

                {/* Items in Single Column with Gutter Photos */}
                <div className="space-y-8">
                  {courseItems.map((item) => (
                    <article
                      key={item.id}
                      className={`menu-line grid grid-cols-1 ${
                        hasCoursePhotos ? 'md:grid-cols-12 gap-6' : 'gap-4'
                      } items-start pb-6 border-b border-[#DDD6C8]/60 ${
                        item.is86 ? 'item-86' : ''
                      }`}
                    >
                      {/* Left Gutter Photograph (If course has photos) */}
                      {hasCoursePhotos && (
                        <div className="md:col-span-4">
                          {item.photoUrl ? (
                            <div className="relative aspect-[4/3] overflow-hidden bg-[#EFE6D5] border border-[#DDD6C8]">
                              <img
                                src={item.photoUrl}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className={`w-full h-full object-cover grayscale contrast-105 hover:grayscale-0 transition-all duration-500 ${
                                  item.is86 ? 'opacity-40' : ''
                                }`}
                                referrerPolicy="no-referrer"
                              />
                              {item.isDishOfDay && !item.is86 && (
                                <span className="absolute top-2 left-2 bg-[#7A2322] text-[#F7F4EE] text-[9px] font-mono-data tracking-widest uppercase px-2 py-0.5">
                                  Dish of the Day
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="hidden md:flex aspect-[4/3] border border-dashed border-[#DDD6C8] bg-[#F7F4EE]/50 items-center justify-center p-4">
                              <span className="font-serif-body text-xs italic text-[#8A827A] text-center">
                                Unphotographed Course Selection
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Right Details Column */}
                      <div className={hasCoursePhotos ? 'md:col-span-8' : 'w-full'}>
                        <div className="flex justify-between items-baseline mb-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-display text-xl sm:text-2xl text-[#1A1715]">
                              {item.name}
                            </h3>
                            {item.isDishOfDay && (
                              <span className="text-[10px] font-mono-data uppercase bg-[#755C38] text-[#F7F4EE] px-2 py-0.5">
                                Featured
                              </span>
                            )}
                            {item.is86 && (
                              <span className="text-xs font-mono-data uppercase font-bold text-[#7A2322] bg-[#7A2322]/10 px-2 py-0.5">
                                86'd — Sold Out
                              </span>
                            )}
                          </div>
                          <span className="font-display text-xl text-[#7A2322] font-semibold pl-4">
                            {formatPrice(item.price)}
                          </span>
                        </div>

                        {/* Structured Fields Line for Cuts: Cut name, Weight, Aging */}
                        {(item.cutName || item.weightGrams || item.agingDays) && (
                          <div className="text-xs font-mono-data text-[#755C38] uppercase tracking-wider mb-2 flex items-center space-x-4">
                            {item.cutName && <span>Cut: {item.cutName}</span>}
                            {item.agingDays && <span>Aging: {item.agingDays} Days</span>}
                            {item.weightGrams && <span>Weight: {item.weightGrams}g</span>}
                          </div>
                        )}

                        <p className="font-serif-body text-sm text-[#1A1715] leading-relaxed mb-3">
                          {item.description}
                        </p>

                        {!item.is86 && onReserveForDish && (
                          <button
                            type="button"
                            onClick={() => onReserveForDish(item.name)}
                            className="text-[11px] font-sans-ui uppercase tracking-widest text-[#665E56] hover:text-[#7A2322] underline underline-offset-4 transition-colors"
                          >
                            Reserve table for this cut
                            <span className="sr-only"> — {item.name}</span>
                            <span aria-hidden="true"> →</span>
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </section>
  );
};
