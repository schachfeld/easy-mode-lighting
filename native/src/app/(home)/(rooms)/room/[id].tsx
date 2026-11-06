import { useLocalSearchParams } from "expo-router";
import { RoomScreen } from "../../../../screens/RoomScreen";

export default function Room() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RoomScreen roomId={id} />;
}
