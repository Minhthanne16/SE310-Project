using System.Text;

namespace Backend.Application.Users;

// Bộ đọc CSV theo RFC 4180: phân cách bằng dấu phẩy, trường trong ngoặc kép có thể
// chứa dấu phẩy, xuống dòng và "" để biểu diễn một dấu ngoặc kép.
public static class CsvReader
{
    public static List<List<string>> Parse(string text)
    {
        var records = new List<List<string>>();
        var record = new List<string>();
        var field = new StringBuilder();
        var inQuotes = false;
        var fieldStarted = false;

        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (inQuotes)
            {
                if (c != '"') field.Append(c);
                else if (i + 1 < text.Length && text[i + 1] == '"') { field.Append('"'); i++; }
                else inQuotes = false;
                continue;
            }

            switch (c)
            {
                case '"' when !fieldStarted:
                    inQuotes = true;
                    fieldStarted = true;
                    break;
                case ',':
                    record.Add(field.ToString());
                    field.Clear();
                    fieldStarted = false;
                    break;
                case '\r' or '\n':
                    if (c == '\r' && i + 1 < text.Length && text[i + 1] == '\n') i++;
                    record.Add(field.ToString());
                    records.Add(record);
                    record = [];
                    field.Clear();
                    fieldStarted = false;
                    break;
                default:
                    field.Append(c);
                    fieldStarted = true;
                    break;
            }
        }

        if (inQuotes) throw new FormatException("Thiếu dấu ngoặc kép đóng.");
        if (fieldStarted || field.Length > 0 || record.Count > 0)
        {
            record.Add(field.ToString());
            records.Add(record);
        }
        return records;
    }
}
