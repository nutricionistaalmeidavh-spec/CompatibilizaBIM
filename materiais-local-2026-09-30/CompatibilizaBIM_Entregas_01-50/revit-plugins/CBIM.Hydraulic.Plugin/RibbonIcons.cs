using System.Windows;
using System.Windows.Media;

namespace CBIM.Hydraulic.Plugin;

internal enum HydraulicIcon { Refine, Build, Qa }

internal static class RibbonIcons
{
    public static ImageSource Create(HydraulicIcon icon)
    {
        var drawing = new DrawingGroup();
        using (var context = drawing.Open())
        {
        var background = new SolidColorBrush(Color.FromRgb(17, 130, 118));
        var white = Brushes.White;
        var pen = new Pen(white, 2.8) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round };
        context.DrawRoundedRectangle(background, null, new Rect(0, 0, 32, 32), 4, 4);

        if (icon == HydraulicIcon.Refine)
        {
            context.DrawLine(pen, new Point(6, 22), new Point(14, 22));
            context.DrawLine(pen, new Point(14, 22), new Point(14, 10));
            context.DrawLine(pen, new Point(14, 10), new Point(25, 10));
            context.DrawEllipse(white, null, new Point(6, 22), 2, 2);
            context.DrawEllipse(white, null, new Point(25, 10), 2, 2);
        }
        else if (icon == HydraulicIcon.Build)
        {
            context.DrawLine(pen, new Point(6, 20), new Point(26, 20));
            context.DrawLine(pen, new Point(16, 7), new Point(16, 17));
            context.DrawLine(pen, new Point(12, 13), new Point(16, 17));
            context.DrawLine(pen, new Point(20, 13), new Point(16, 17));
        }
        else
        {
            context.DrawEllipse(null, pen, new Point(14, 14), 6.5, 6.5);
            context.DrawLine(pen, new Point(18.8, 18.8), new Point(25, 25));
            context.DrawLine(pen, new Point(10.5, 14), new Point(13, 16.5));
            context.DrawLine(pen, new Point(13, 16.5), new Point(17.5, 11));
        }

        }
        drawing.Freeze();
        return new DrawingImage(drawing);
    }
}
