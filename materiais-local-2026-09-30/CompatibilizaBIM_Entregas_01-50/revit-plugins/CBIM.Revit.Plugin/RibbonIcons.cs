using System.Windows;
using System.Windows.Media;

namespace CBIM.Revit.Plugin;

internal enum CoreIcon { Dwg, Analyze, Reconstruct, Review }

internal static class RibbonIcons
{
    public static ImageSource Create(CoreIcon icon)
    {
        var drawing = new DrawingGroup();
        using (var context = drawing.Open())
        {
        var background = new SolidColorBrush(Color.FromRgb(25, 112, 164));
        var white = Brushes.White;
        var pen = new Pen(white, 2.4) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round };
        context.DrawRoundedRectangle(background, null, new Rect(0, 0, 32, 32), 4, 4);

        switch (icon)
        {
            case CoreIcon.Dwg:
                context.DrawRectangle(null, pen, new Rect(8, 5, 15, 22));
                context.DrawLine(pen, new Point(12, 12), new Point(20, 12));
                context.DrawLine(pen, new Point(12, 17), new Point(20, 17));
                context.DrawLine(pen, new Point(12, 22), new Point(17, 22));
                break;
            case CoreIcon.Analyze:
                context.DrawEllipse(null, pen, new Point(14, 14), 6.5, 6.5);
                context.DrawLine(pen, new Point(18.8, 18.8), new Point(25, 25));
                break;
            case CoreIcon.Reconstruct:
                context.DrawRectangle(null, pen, new Rect(7, 8, 9, 9));
                context.DrawRectangle(null, pen, new Rect(16, 15, 9, 9));
                context.DrawLine(pen, new Point(11.5, 17), new Point(11.5, 22));
                context.DrawLine(pen, new Point(11.5, 22), new Point(16, 22));
                break;
            case CoreIcon.Review:
                context.DrawRectangle(null, pen, new Rect(7, 5, 18, 22));
                context.DrawLine(pen, new Point(11, 17), new Point(14.5, 21));
                context.DrawLine(pen, new Point(14.5, 21), new Point(21.5, 12));
                break;
        }

        }
        drawing.Freeze();
        return new DrawingImage(drawing);
    }
}
