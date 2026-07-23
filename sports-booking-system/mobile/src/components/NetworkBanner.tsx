import NetInfo from "@react-native-community/netinfo";
import { useNetInfo } from "@react-native-community/netinfo";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme/tokens";

export function NetworkBanner() {
  const netInfo = useNetInfo();
  const offline = netInfo.isConnected === false || netInfo.isInternetReachable === false;
  if (!offline) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Mat ket noi mang. Du lieu dang hien thi co the la cache.</Text>
    </View>
  );
}

void NetInfo;

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warning,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  text: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: "800",
    textAlign: "center"
  }
});

