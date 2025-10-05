import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalStorage as useLocalStorageHook } from "@/hooks/useLocalStorage";
import { useDarkTheme, type Theme } from "@/hooks/useDarkTheme";

export default function Settings() {
  const { theme, setTheme } = useDarkTheme();
  const handleThemeChange = (value: string) => setTheme(value as Theme);
  const [city, setCity] = useLocalStorageHook("airsight:preferredCity", "");
  const [lang, setLang] = useLocalStorageHook("airsight:lang", "en");
  const [palette, setPalette] = useLocalStorageHook(
    "airsight:palette",
    "default",
  );
  const [fontScale, setFontScale] = useLocalStorageHook(
    "airsight:fontScale",
    1,
  );

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Theme</div>
            <Select value={theme} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">
              Colorblind-friendly palette
            </div>
            <Select value={palette} onValueChange={setPalette}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="deuteranopia">Deuteranopia</SelectItem>
                <SelectItem value="protanopia">Protanopia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Font size</div>
            <Input
              type="number"
              step="0.1"
              value={fontScale}
              onChange={(e) => setFontScale(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">
              Preferred City
            </div>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City or Coordinates"
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Language</div>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 text-xs text-muted-foreground">
            Data sources: NASA TEMPO, OpenAQ, OpenWeather/Open-Meteo. Tokens are
            stored securely on server; frontend never exposes secrets.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
