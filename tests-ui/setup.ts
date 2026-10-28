jest.mock("expo-router", () => ({
  useSegments: () => [],
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  useRootNavigationState: () => ({ key: "root" }),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: Text };
});
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  dismissAllNotificationsAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(async () => []),
  dismissNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    FadeInDown: { duration: () => undefined },
    useFrameCallback: jest.fn(),
    runOnJS: (fn: unknown) => fn,
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedProps: () => ({}),
    withTiming: (v: unknown) => v,
    createAnimatedComponent: (c: unknown) => c,
  };
});
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View, SafeAreaProvider: View };
});

jest.mock(
  "@react-native-community/datetimepicker",
  () => require("react-native").View,
);
