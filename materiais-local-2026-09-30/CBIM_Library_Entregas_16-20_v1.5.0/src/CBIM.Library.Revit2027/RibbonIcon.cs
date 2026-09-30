using System.Windows;
using System.Windows.Media;

namespace CBIM.Library.Revit2027;

internal static class RibbonIcon
{
    public static ImageSource Create()
    {
        var drawing = new DrawingGroup();
        using (var context = drawing.Open())
        {
            var background = new SolidColorBrush(Color.FromRgb(103, 70, 157));
            var pen = new Pen(Brushes.White, 2.2) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round };
            context.DrawRoundedRectangle(background, null, new Rect(0, 0, 32, 32), 4, 4);
            context.DrawRectangle(null, pen, new Rect(7, 8, 5, 16));
            context.DrawRectangle(null, pen, new Rect(14, 6, 5, 18));
            context.DrawRectangle(null, pen, new Rect(21, 10, 4, 14));
            context.DrawLine(pen, new Point(7, 25), new Point(25, 25));
        }
        drawing.Freeze();
        return new DrawingImage(drawing);
    }
}
