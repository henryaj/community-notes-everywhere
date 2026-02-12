class CreateRatings < ActiveRecord::Migration[8.1]
  def change
    create_table :ratings do |t|
      t.references :user, null: false, foreign_key: true
      t.references :note, null: false, foreign_key: true
      t.boolean :helpful, null: false

      t.timestamps
    end

    add_index :ratings, [ :user_id, :note_id ], unique: true
  end
end
