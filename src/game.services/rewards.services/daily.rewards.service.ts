//** SERVICE IMPORTS
import SongRewardService from "./song.rewards.service";


class DailyRewardService {
    public async dailyLoginReward(username: string) {
      const songRewardService: SongRewardService = new SongRewardService();

      try {
        songRewardService.sendBeatsReward(username, 500);


      } catch(error: any) {
        throw error
      }
    }
    

}

export default DailyRewardService;