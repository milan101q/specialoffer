import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/use-mobile'; 
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';

interface ContactClick {
  id: number;
  vehicleId: number;
  timestamp: string;
  title: string;
  make: string;
  model: string;
  year: number;
  dealershipId: number;
}

interface ChartData {
  date: string;
  count: number;
}

export default function ContactClicksHistory() {
  const [activeTab, setActiveTab] = useState('table');
  const isMobile = useIsMobile();
  
  const { data: contactClicks, isLoading } = useQuery<ContactClick[]>({
    queryKey: ['/api/contact-clicks'],
  });
  
  // Helper function to format the date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  // Mobile-friendly short date format
  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };
  
  // Prepare chart data from contact clicks
  const prepareChartData = (): ChartData[] => {
    if (!contactClicks || contactClicks.length === 0) return [];
    
    // Group by date (without time)
    const groupedData = contactClicks.reduce((acc, click) => {
      const date = new Date(click.timestamp);
      const dateString = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
      
      if (!acc[dateString]) {
        acc[dateString] = 0;
      }
      
      acc[dateString]++;
      return acc;
    }, {} as Record<string, number>);
    
    // Convert to array for the chart
    return Object.entries(groupedData)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => {
        // Sort by date (newest first)
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 10) // Last 10 days with activity
      .reverse(); // Reverse to have oldest first for the chart
  };
  
  // Prepare data grouping by vehicle make
  const prepareMakeData = () => {
    if (!contactClicks || contactClicks.length === 0) return [];
    
    // Group by make
    const groupedData = contactClicks.reduce((acc, click) => {
      const make = click.make || 'Unknown';
      
      if (!acc[make]) {
        acc[make] = 0;
      }
      
      acc[make]++;
      return acc;
    }, {} as Record<string, number>);
    
    // Convert to array and sort by count
    return Object.entries(groupedData)
      .map(([make, count]) => ({ make, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, isMobile ? 5 : 10); // Limit to 5 on mobile, 10 on desktop
  };
  
  const chartData = prepareChartData();
  const makeData = prepareMakeData();
  
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="animate-pulse">
            <div className="h-8 w-48 bg-gray-300 rounded"></div>
          </CardTitle>
          <CardDescription className="animate-pulse">
            <div className="h-4 w-64 bg-gray-300 rounded"></div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-gray-200 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle>Lead Generation History</CardTitle>
        <CardDescription>
          Track when and how users are contacting dealers about vehicles
        </CardDescription>
      </CardHeader>
      <Tabs 
        defaultValue="table" 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="w-full"
      >
        <div className={cn("px-6", isMobile ? "pb-2" : "")}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="table" className="text-xs md:text-sm">
              {isMobile ? "Recent" : "Recent Activity"}
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs md:text-sm">
              Timeline
            </TabsTrigger>
            <TabsTrigger value="makes" className="text-xs md:text-sm">
              By Make
            </TabsTrigger>
          </TabsList>
        </div>
        
        <CardContent className={cn(isMobile ? "p-3" : "")}>
          <TabsContent value="table" className="space-y-4">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={cn(isMobile ? "py-2 px-2" : "")}>Time</TableHead>
                    <TableHead className={cn(isMobile ? "py-2 px-2" : "")}>Vehicle</TableHead>
                    <TableHead className="hidden md:table-cell">Year</TableHead>
                    <TableHead className="hidden md:table-cell">Make</TableHead>
                    <TableHead className="hidden md:table-cell">Model</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contactClicks && contactClicks.length > 0 ? (
                    contactClicks.map((click) => (
                      <TableRow key={click.id}>
                        <TableCell className={cn(
                          "font-medium",
                          isMobile && "py-1.5 px-2 text-xs"
                        )}>
                          {isMobile ? formatShortDate(click.timestamp) : formatDate(click.timestamp)}
                        </TableCell>
                        <TableCell className={cn(
                          isMobile && "py-1.5 px-2 text-xs truncate max-w-[150px]",
                          "relative",
                          // Add faded style for deleted vehicles
                          click.title?.startsWith('Vehicle #') && "italic text-gray-500"
                        )}>
                          {/* Show full information with fallbacks */}
                          {click.title}
                          {/* For mobile view, show badges with better fallback handling */}
                          {isMobile && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {click.make && (
                                <Badge variant="outline" className={cn(
                                  "text-[10px] px-1 py-0 h-4",
                                  click.make === "Unknown" && "bg-gray-100"
                                )}>
                                  {click.make}
                                </Badge>
                              )}
                              {click.year && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                  {click.year}
                                </Badge>
                              )}
                              {/* Show deleted status if applicable */}
                              {click.title?.startsWith('Vehicle #') && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-red-50 text-red-500 border-red-200">
                                  Deleted
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={cn(
                          "hidden md:table-cell", 
                          click.title?.startsWith('Vehicle #') && "italic text-gray-500"
                        )}>
                          {click.year || 'N/A'}
                        </TableCell>
                        <TableCell className={cn(
                          "hidden md:table-cell",
                          click.title?.startsWith('Vehicle #') && "italic text-gray-500"
                        )}>
                          {click.make || 'N/A'}
                        </TableCell>
                        <TableCell className={cn(
                          "hidden md:table-cell",
                          click.title?.startsWith('Vehicle #') && "italic text-gray-500"
                        )}>
                          {click.model || 'N/A'}
                          {/* Show deleted status on desktop if vehicle is deleted */}
                          {click.title?.startsWith('Vehicle #') && (
                            <Badge className="ml-2 px-1 py-0 h-5 bg-red-50 text-red-500 border-red-200">
                              Deleted
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell 
                        colSpan={5} 
                        className={cn(
                          "text-center py-6 text-neutral-500",
                          isMobile && "py-3"
                        )}
                      >
                        No contact activity recorded yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="timeline">
            <div className={cn("h-80", isMobile && "h-56")}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{
                      top: 20,
                      right: isMobile ? 10 : 30,
                      left: isMobile ? 10 : 20,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      tickMargin={isMobile ? 5 : 10}
                    />
                    <YAxis 
                      width={isMobile ? 20 : 40}
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Contact Clicks"
                      stroke="#8884d8"
                      strokeWidth={isMobile ? 1.5 : 2}
                      activeDot={{ r: isMobile ? 6 : 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
                  Not enough data to display a timeline
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="makes">
            <div className={cn("h-80", isMobile && "h-56")}>
              {makeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={makeData}
                    layout="vertical"
                    margin={{
                      top: 20,
                      right: isMobile ? 10 : 30,
                      left: isMobile ? 65 : 70,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                    />
                    <YAxis 
                      dataKey="make" 
                      type="category" 
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      width={isMobile ? 60 : 70}
                    />
                    <Tooltip />
                    {!isMobile && <Legend />}
                    <Bar 
                      dataKey="count" 
                      name="Contact Clicks" 
                      fill="#8884d8" 
                      radius={[0, 4, 4, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
                  Not enough data to display make statistics
                </div>
              )}
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}