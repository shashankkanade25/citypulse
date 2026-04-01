interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: string;
  bgGradient?: string;
}

export default function StatCard({ title, value, icon, trend, color = '#09E0F7', bgGradient }: StatCardProps) {
  return (
    <div 
      className="rounded-3xl px-6 py-8 shadow-sm hover:shadow-md transition-all"
      style={bgGradient ? { background: bgGradient } : { backgroundColor: '#FFFFFF' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="text-4xl">{icon}</div>
        {trend && (
          <div 
            className="text-xs font-bold px-2 py-1 rounded-lg"
            style={{ 
              backgroundColor: trend.isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: trend.isPositive ? '#10B981' : '#EF4444'
            }}
          >
            {trend.isPositive ? '▲' : '▼'} {trend.value}
          </div>
        )}
      </div>
      <div 
        className="text-4xl lg:text-5xl font-bold mb-2" 
        style={{ fontFamily: "'Unbounded', sans-serif", color }}
      >
        {value}
      </div>
      <div className="text-sm font-semibold" style={{ color: '#131C15', opacity: 0.7 }}>
        {title}
      </div>
    </div>
  );
}
