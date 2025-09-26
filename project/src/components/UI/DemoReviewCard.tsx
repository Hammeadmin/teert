// src/components/UI/DemoReviewCard.tsx
import React, { useState } from 'react';
import { Star, ThumbsUp, CheckSquare, MessageSquare } from 'lucide-react';

export const DemoReviewCard = () => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 relative max-w-sm mx-auto border border-gray-200">
      <div className="flex items-center">
        <img
          src="https://i.pravatar.cc/150?u=a042581f4e29026704d"
          alt="Exempel Farmaceut"
          className="h-20 w-20 rounded-full object-cover border-4 border-white shadow-md"
        />
        <div className="ml-4">
          <h4 className="text-lg font-bold text-gray-800">Anna Svensson</h4>
          <p className="text-sm text-primary-600 font-semibold">Leg. Apotekare</p>
          <div className="flex items-center mt-1">
            <Star className="w-4 h-4 text-amber-400 fill-current" />
            <span className="text-sm text-gray-600 font-bold ml-1">4.9</span>
            <span className="text-xs text-gray-500 ml-1">(14 omdömen)</span>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="relative">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <ThumbsUp className="h-5 w-5 text-green-500" />
            </div>
            <div className="ml-3">
              <h5
                className="text-sm font-semibold text-gray-700 underline decoration-dotted cursor-pointer"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                Omdöme från Apoteksgruppen
              </h5>
              <p className="text-sm text-gray-600 mt-1 italic">"Anna är exceptionellt kunnig och en fröjd att arbeta med. Hon tog initiativ och våra kunder älskade henne. Rekommenderas starkt!"</p>
            </div>
          </div>
          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-gray-800 text-white text-xs rounded-md py-1.5 px-3 z-10 shadow-lg animate-fade-in">
              Arbetsgivare lämnar omdömen efter varje avslutat pass.
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 transform rotate-45" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};