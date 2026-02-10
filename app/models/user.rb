class User < ApplicationRecord
  has_many :notes, foreign_key: :author_id, dependent: :destroy
  has_many :ratings, dependent: :destroy

  validates :twitter_uid, presence: true, uniqueness: true

  before_create :generate_auth_token

  def self.find_or_create_from_oauth(auth)
    user = find_or_initialize_by(twitter_uid: auth.uid)
    user.twitter_handle = auth.info.nickname
    user.display_name = auth.info.name
    user.avatar_url = auth.info.image
    user.follower_count = auth.extra.raw_info.public_metrics&.followers_count rescue nil
    user.account_created_at = auth.extra.raw_info.created_at rescue nil
    user.save!
    user.recalculate_reputation!
    user
  end

  def recalculate_reputation!
    score = 0.0

    # Account age bonus (up to 20 points for accounts > 5 years old)
    if account_created_at
      years_old = (Time.current - account_created_at) / 1.year
      score += [years_old * 4, 20].min
    end

    # Follower count bonus (logarithmic, up to 30 points)
    if follower_count && follower_count > 0
      score += [Math.log10(follower_count) * 10, 30].min
    end

    # Note history bonus (up to 50 points)
    total_notes = notes.count
    if total_notes > 0
      helpful_notes = notes.where(status: :helpful).count
      score += (helpful_notes.to_f / total_notes) * 50
    end

    update!(reputation_score: score.round(2))
  end

  private

  def generate_auth_token
    self.auth_token = SecureRandom.hex(32)
  end
end
