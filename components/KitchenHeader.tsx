import React from 'react';

interface KitchenHeaderProps {
  restaurantName?: string;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  orderCount?: number;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  currentTime?: Date;
}

const KitchenHeader = ({
  restaurantName = "Cozinha Digital",
  soundEnabled = true,
  onToggleSound,
  orderCount = 0,
  isDarkMode = false,
  onToggleDarkMode,
  onToggleFullscreen,
  isFullscreen = false,
  currentTime = new Date(),
}: KitchenHeaderProps) => {
  return (
    <header className={`sticky top-0 z-50 ${isDarkMode ? 'bg-slate-800' : 'bg-gradient-to-r from-orange-600 to-red-600'} text-white shadow-lg`}>
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🍳</div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{restaurantName}</h1>
              <p className="text-sm opacity-90">Pedidos em tempo real</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Relógio */}
            <div className="text-center bg-white/20 rounded-xl px-4 py-2">
              <div className="text-2xl font-mono font-bold">
                {currentTime.toLocaleTimeString("pt-BR")}
              </div>
              <div className="text-xs opacity-80">
                {currentTime.toLocaleDateString("pt-BR")}
              </div>
            </div>

            {/* Status da conexão */}
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-sm font-medium">Online</span>
            </div>

            {/* Contador */}
            <div className="bg-white/20 rounded-full px-4 py-2">
              <span className="font-bold text-lg">{orderCount}</span>
              <span className="text-xs ml-1">ativos</span>
            </div>

            {/* Botões */}
            <div className="flex gap-2">
              {onToggleFullscreen && (
                <button
                  onClick={onToggleFullscreen}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-all"
                >
                  <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
                </button>
              )}
              {onToggleDarkMode && (
                <button
                  onClick={onToggleDarkMode}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-all"
                >
                  <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
                </button>
              )}
              <button
                onClick={onToggleSound}
                className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-all"
              >
                {soundEnabled ? "🔊" : "🔇"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default KitchenHeader;