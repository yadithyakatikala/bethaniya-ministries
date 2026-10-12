import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { UpdateDetail } from '../updates/UpdateDetail';

type Props = NativeStackScreenProps<RootStackParamList, 'AnnouncementDetail'>;

/**
 * Announcement detail -- receives the full announcement object as a route
 * param (the Updates feed already holds the complete, real-time list, so
 * passing the object avoids a redundant second Firestore subscription).
 *
 * It is the SAME screen as a church post's -- ../updates/UpdateDetail.tsx --
 * because to a member an announcement and a post are one kind of thing.
 */
export function AnnouncementDetailScreen({ navigation, route }: Props) {
  const { announcement } = route.params;
  return (
    <UpdateDetail
      kind="announcement"
      title={announcement.title}
      content={announcement.content}
      imageUrl={announcement.imageUrl}
      createdAt={announcement.createdAt}
      onBack={() => navigation.goBack()}
      testPrefix="announcement-detail"
    />
  );
}
